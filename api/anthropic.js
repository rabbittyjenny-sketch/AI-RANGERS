/**
 * Vercel Serverless Function — Ranger chat → Claude
 *
 * Route: POST /api/anthropic  (vercel.json ยัง rewrite /api/anthropic/v1/* มาที่นี่ด้วย)
 *
 * Browser ส่งมาแค่ { system, messages } — server เป็นคนกำหนด model, max_tokens,
 * effort และ tools เอง เพื่อไม่ให้ใครใช้ proxy นี้เรียกโมเดลแพง/ยาวเกินกำหนด
 * ANTHROPIC_API_KEY อยู่ฝั่ง server เท่านั้น
 *
 * Env (ตั้งใน Vercel — ทุกตัว optional ยกเว้น ANTHROPIC_API_KEY):
 *   CLAUDE_MODEL          default claude-sonnet-4-6 (โมเดลที่ใช้มาตลอด — Haiku ตอบคุณภาพไม่พอ)
 *   CLAUDE_EFFORT         low | medium | high | none   (default none = ไม่ส่ง effort เหมือนเดิม)
 *   CHAT_MAX_TOKENS       default 4096
 *   WEB_SEARCH_MAX_USES   default 2 ครั้งต่อข้อความ (0 = ปิด) — แนบแหล่งอ้างอิงจริงของผลค้นท้ายคำตอบ
 *   CHAT_RATE_LIMIT       ข้อความต่อ IP ต่อชั่วโมง, default 40 (0 = ไม่จำกัด)
 *   ALLOWED_ORIGINS       origin เพิ่มเติมที่อนุญาต คั่นด้วย comma
 *   DAILY_CREDITS / DAILY_USER_CAP / IP_DAILY_USER_LIMIT / CREDITS_ENABLED — ดู api/_lib/credits.js
 *
 * เครดิต: ข้อความใหม่หักเครดิตก่อนเรียก Claude (คืนให้ถ้า error) แล้วตอบ turnId กลับไป
 * รอบที่ Guard สั่งให้เขียนใหม่ ส่ง turnId เดิมมา — ไม่หักเครดิต (สูงสุด 2 รอบต่อ turn)
 */

import {
  DEFAULT_CHAT_MODEL,
  getClient,
  envInt,
  isAllowedOrigin,
  clientIp,
  takeRateLimit,
  toErrorPayload,
  sendError,
  extractText,
  extractSources,
} from './_lib/claude.js';
import { logUsage } from './_lib/usage.js';
import {
  creditConfig,
  getCreditStore,
  bangkokDay,
  nextResetIso,
  creditCost,
  countAttachments,
  userKeyFrom,
} from './_lib/credits.js';

const CREDIT_MESSAGES = {
  quota_exceeded: 'เครดิตวันนี้หมดแล้ว จะรีเซ็ตตอนเที่ยงคืน',
  daily_user_cap: 'วันนี้มีผู้ใช้งานเต็มจำนวนแล้ว',
  ip_user_limit: 'เครือข่ายนี้มีผู้ใช้งานครบจำนวนแล้ววันนี้',
};

const MAX_MESSAGES = 30;
const MAX_SYSTEM_CHARS = 30000;
const MAX_TEXT_CHARS = 200000; // เพดานกันข้อความใหญ่ผิดปกติ (ประมาณ 100k token) — เพดานจริงของไฟล์แนบคือจำนวนไฟล์ต่อวัน
const MAX_PAUSE_CONTINUATIONS = 3;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/**
 * ตรวจรูปแบบ body จาก browser
 * @returns {{ ok: true, system: string, messages: any[] } | { ok: false, message: string }}
 */
export function validateChatBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, message: 'body ต้องเป็น JSON' };

  const { system, messages } = body;
  if (typeof system !== 'string' || system.length === 0 || system.length > MAX_SYSTEM_CHARS) {
    return { ok: false, message: 'system ไม่ถูกต้อง' };
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return { ok: false, message: 'messages ไม่ถูกต้อง' };
  }

  let textChars = 0;
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return { ok: false, message: 'role ไม่ถูกต้อง' };
    }
    if (typeof m.content === 'string') {
      textChars += m.content.length;
      clean.push({ role: m.role, content: m.content });
      continue;
    }
    if (!Array.isArray(m.content) || m.content.length === 0) {
      return { ok: false, message: 'content ไม่ถูกต้อง' };
    }
    const blocks = [];
    for (const b of m.content) {
      if (b?.type === 'text' && typeof b.text === 'string') {
        textChars += b.text.length;
        blocks.push({ type: 'text', text: b.text });
      } else if (
        b?.type === 'image' &&
        b.source?.type === 'base64' &&
        IMAGE_TYPES.has(b.source.media_type) &&
        typeof b.source.data === 'string'
      ) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: b.source.media_type, data: b.source.data },
        });
      } else {
        return { ok: false, message: 'ชนิด content ไม่รองรับ' };
      }
    }
    clean.push({ role: m.role, content: blocks });
  }

  if (textChars > MAX_TEXT_CHARS) return { ok: false, message: 'ข้อความยาวเกินกำหนด' };
  if (clean[0].role !== 'user' || clean[clean.length - 1].role !== 'user') {
    return { ok: false, message: 'ลำดับข้อความไม่ถูกต้อง' };
  }
  return { ok: true, system, messages: clean };
}

/**
 * ประกอบ request ไป Claude — ค่าที่กำหนดราคา (model/max_tokens/tools) มาจาก env เท่านั้น
 * Prompt caching: cache system prompt + ข้อความล่าสุด เพื่อให้รอบถัดไปอ่าน prefix จาก cache
 */
export function buildChatRequest(system, messages) {
  const lastIdx = messages.length - 1;
  const cachedMessages = messages.map((m, i) => {
    if (i !== lastIdx) return m;
    const blocks = typeof m.content === 'string'
      ? [{ type: 'text', text: m.content }]
      : m.content.map(b => ({ ...b }));
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral' } };
    return { role: m.role, content: blocks };
  });

  const request = {
    model: process.env.CLAUDE_MODEL || DEFAULT_CHAT_MODEL,
    max_tokens: envInt('CHAT_MAX_TOKENS', 4096),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: cachedMessages,
  };

  const effort = process.env.CLAUDE_EFFORT || 'none';
  if (effort !== 'none') request.output_config = { effort };

  const searchUses = envInt('WEB_SEARCH_MAX_USES', 2);
  if (searchUses > 0) {
    request.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: searchUses }];
  }
  return request;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Method not allowed');
  }
  if (!isAllowedOrigin(req)) {
    return sendError(res, 403, 'forbidden_origin', 'Origin not allowed');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return sendError(res, 500, 'not_configured', 'ANTHROPIC_API_KEY not configured on server');
  }
  if (!takeRateLimit('chat', clientIp(req), envInt('CHAT_RATE_LIMIT', 40))) {
    return sendError(res, 429, 'rate_limited', 'ส่งข้อความถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
  }

  const parsed = validateChatBody(req.body);
  if (!parsed.ok) return sendError(res, 400, 'invalid_request', parsed.message);

  // ── เครดิต ───────────────────────────────────────────────────────────────
  const cfg = creditConfig();
  const day = bangkokDay();
  const userKey = userKeyFrom(req);
  const ip = clientIp(req);
  const retryTurnId = typeof req.body?.turnId === 'string' ? req.body.turnId : null;
  let store = null;
  let charged = 0;
  let filesCharged = 0;
  let credits = null;
  const balance = (cost, used, files) => ({
    cost, used, remaining: Math.max(cfg.dailyCredits - used, 0), limit: cfg.dailyCredits, resetsAt: nextResetIso(),
    filesUsed: files, filesLimit: cfg.dailyFiles,
  });

  if (cfg.enabled) {
    store = await getCreditStore();
    if (retryTurnId) {
      const allowed = await store.useTurnRetry({ turnId: retryTurnId, userKey, day, cfg });
      if (!allowed) return sendError(res, 429, 'retry_not_allowed', 'ไม่สามารถสร้างคำตอบใหม่ได้');
    } else {
      const cost = creditCost(parsed.messages);
      const files = countAttachments(parsed.messages);
      const r = await store.reserve({ userKey, ip, cost, files, day, cfg });
      if (!r.ok) {
        return res.status(429).json({
          error: {
            code: r.reason,
            message: r.reason === 'file_limit' ? `แนบไฟล์ได้วันละ ${cfg.dailyFiles} ไฟล์ วันนี้ครบแล้ว` : CREDIT_MESSAGES[r.reason],
          },
          credits: balance(0, r.used, r.files ?? 0),
        });
      }
      charged = cost;
      filesCharged = files;
      credits = balance(cost, r.used, r.files ?? files);
    }
  }

  const request = buildChatRequest(parsed.system, parsed.messages);
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, web_search_requests: 0 };

  try {
    const client = getClient();
    let response;
    let text = '';
    const sources = [];
    for (let i = 0; i <= MAX_PAUSE_CONTINUATIONS; i++) {
      response = await client.messages.create(request, { timeout: 75_000, maxRetries: 1 });
      const u = response.usage || {};
      usage.input_tokens += u.input_tokens || 0;
      usage.output_tokens += u.output_tokens || 0;
      usage.cache_read_input_tokens += u.cache_read_input_tokens || 0;
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
      usage.web_search_requests += u.server_tool_use?.web_search_requests || 0;
      text += extractText(response.content);
      for (const s of extractSources(response.content)) {
        if (sources.length < 3 && !sources.some(x => x.url === s.url)) sources.push(s);
      }

      if (response.stop_reason !== 'pause_turn') break;
      // web search ที่ใช้เวลานาน — ส่ง assistant content กลับไปให้ทำต่อ
      request.messages = [...request.messages, { role: 'assistant', content: response.content }];
    }

    // ไม่ได้คำตอบที่ใช้ได้ (ปฏิเสธ/ว่าง) — คืนเครดิต
    if (charged && (response.stop_reason === 'refusal' || !text.trim())) {
      await store.refund({ userKey, cost: charged, files: filesCharged, day });
      credits = null;
    }
    // ค้นเว็บจริงในข้อความนี้ → หักเพิ่มตามต้นทุนจริง (เท่าที่เหลือ ไม่ติดลบ)
    if (store && charged && credits && usage.web_search_requests > 0 && cfg.searchExtra > 0) {
      const extra = Math.min(cfg.searchExtra, Math.max(cfg.dailyCredits - credits.used, 0));
      if (extra > 0) {
        const r = await store.reserve({ userKey, ip, cost: extra, day, cfg });
        if (r.ok) {
          charged += extra;
          credits = balance(charged, r.used, r.files ?? credits.filesUsed);
        }
      }
    }
    // ตัวเลขใช้จริงต่อข้อความ (ไม่มีเนื้อหา/ตัวตนผู้ใช้) — ไว้ตรวจต้นทุนจาก Vercel logs
    console.info('[api/anthropic] usage', JSON.stringify({ model: response.model, ...usage, credits: credits?.cost ?? 0, retry: !!retryTurnId }));
    // นับการใช้งานรายน้อง (ข้อความใหม่ที่ได้คำตอบเท่านั้น — ไม่นับรอบที่ guard สั่งแก้ ไม่นับที่ error/ปฏิเสธ)
    if (!retryTurnId && text.trim() && response.stop_reason !== 'refusal') {
      await logUsage({ agent: req.body?.agent, userKey, day });
    }
    const turnId = credits ? await store.openTurn({ userKey, day }) : undefined;

    return res.status(200).json({
      text,
      sources,
      stopReason: response.stop_reason,
      model: response.model,
      usage,
      credits,
      turnId,
    });
  } catch (err) {
    if (charged) await store.refund({ userKey, cost: charged, files: filesCharged, day }).catch(() => {});
    const e = toErrorPayload(err);
    console.error('[api/anthropic]', e.code, err?.status, String(err?.message || '').slice(0, 300));
    return sendError(res, e.status, e.code, e.message);
  }
}
