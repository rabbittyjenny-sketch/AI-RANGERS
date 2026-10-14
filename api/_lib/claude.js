/**
 * Shared helpers for the Claude serverless functions (/api/anthropic, /api/guard).
 *
 * Files under api/_lib are not exposed as routes by Vercel.
 *
 * หลักการ:
 * - Server เป็นคนกำหนด model / max_tokens / tools เอง — ไม่เชื่อค่าจาก browser
 * - รับเฉพาะ request จากโดเมนของเราเอง (same-origin หรือ ALLOWED_ORIGINS)
 * - จำกัดจำนวน request ต่อ IP (best-effort — นับแยกต่อ instance ของ serverless)
 */

import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_CHAT_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_GUARD_MODEL = 'claude-haiku-5-5';

let client = null;
export function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ── Number env helper ─────────────────────────────────────────────────────────
export function envInt(name, fallback) {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ── Origin check ──────────────────────────────────────────────────────────────
/**
 * Browser ส่ง Origin header มากับ POST เสมอ — ถ้าไม่ตรงกับโดเมนเรา ให้ปฏิเสธ
 * (กันเว็บอื่นเรียกใช้ proxy นี้จาก browser ของผู้ใช้เขา)
 * Request ที่ไม่มี Origin (เช่น curl) ยังผ่านด่านนี้ได้ — ด่านที่กันจริงคือ
 * rate limit + การล็อก model/max_tokens ฝั่ง server
 */
export function isAllowedOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;

  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host && originHost === host) return true;

  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

// ── Rate limit (in-memory, per instance) ──────────────────────────────────────
const buckets = new Map();
const WINDOW_MS = 60 * 60 * 1000;

export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

/** @returns {boolean} true ถ้ายังไม่เกินโควต้า */
export function takeRateLimit(scope, ip, limitPerHour, now = Date.now()) {
  if (limitPerHour <= 0) return true;
  const key = `${scope}:${ip}`;
  const hits = (buckets.get(key) || []).filter(t => now - t < WINDOW_MS);
  if (hits.length >= limitPerHour) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  // กัน Map โตไม่หยุดใน instance ที่อยู่นาน
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some(t => now - t < WINDOW_MS)) buckets.delete(k);
    }
  }
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}

// ── Error mapping ─────────────────────────────────────────────────────────────
/**
 * แปลง error จาก SDK เป็น code ที่ฝั่ง UI ใช้แสดงข้อความให้ผู้ใช้ได้ตรงสาเหตุ
 */
export function toErrorPayload(err) {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return { status: 502, code: 'auth', message: 'API key ไม่ถูกต้องหรือไม่มีสิทธิ์' };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 503, code: 'upstream_rate_limited', message: 'Claude API ถูกจำกัดอัตราชั่วคราว' };
  }
  if (err instanceof Anthropic.BadRequestError) {
    const msg = String(err.message || '');
    if (/credit balance/i.test(msg)) {
      return { status: 502, code: 'billing', message: 'เครดิต Claude API ไม่พอ' };
    }
    return { status: 502, code: 'bad_request', message: msg.slice(0, 300) };
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, code: 'timeout', message: 'Claude API ตอบช้าเกินกำหนด' };
  }
  if (err instanceof Anthropic.APIError) {
    // 529 overloaded / 5xx
    return { status: 503, code: 'overloaded', message: 'Claude API ไม่พร้อมชั่วคราว' };
  }
  return { status: 500, code: 'internal', message: 'เกิดข้อผิดพลาดภายใน server' };
}

export function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

/** รวม text block ทั้งหมดของ response (web search แยกข้อความเป็นหลาย block) */
export function extractText(content) {
  return (content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}
