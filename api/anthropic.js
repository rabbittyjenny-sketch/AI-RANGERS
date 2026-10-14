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
 *   CLAUDE_MODEL          default claude-haiku-5-5
 *   CLAUDE_EFFORT         low | medium | high | none   (default low; none = ไม่ส่ง effort)
 *   CHAT_MAX_TOKENS       default 4096
 *   WEB_SEARCH_MAX_USES   default 2 (0 = ปิด web search)
 *   CHAT_RATE_LIMIT       ข้อความต่อ IP ต่อชั่วโมง, default 40 (0 = ไม่จำกัด)
 *   ALLOWED_ORIGINS       origin เพิ่มเติมที่อนุญาต คั่นด้วย comma
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
} from './_lib/claude.js';

const MAX_MESSAGES = 30;
const MAX_SYSTEM_CHARS = 30000;
const MAX_TEXT_CHARS = 60000;
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

  const effort = process.env.CLAUDE_EFFORT || 'low';
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

  const request = buildChatRequest(parsed.system, parsed.messages);
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, web_search_requests: 0 };

  try {
    const client = getClient();
    let response;
    let text = '';
    for (let i = 0; i <= MAX_PAUSE_CONTINUATIONS; i++) {
      response = await client.messages.create(request, { timeout: 75_000, maxRetries: 1 });
      const u = response.usage || {};
      usage.input_tokens += u.input_tokens || 0;
      usage.output_tokens += u.output_tokens || 0;
      usage.cache_read_input_tokens += u.cache_read_input_tokens || 0;
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
      usage.web_search_requests += u.server_tool_use?.web_search_requests || 0;
      text += extractText(response.content);

      if (response.stop_reason !== 'pause_turn') break;
      // web search ที่ใช้เวลานาน — ส่ง assistant content กลับไปให้ทำต่อ
      request.messages = [...request.messages, { role: 'assistant', content: response.content }];
    }

    return res.status(200).json({
      text,
      stopReason: response.stop_reason,
      model: response.model,
      usage,
    });
  } catch (err) {
    const e = toErrorPayload(err);
    console.error('[api/anthropic]', e.code, err?.status, String(err?.message || '').slice(0, 300));
    return sendError(res, e.status, e.code, e.message);
  }
}
