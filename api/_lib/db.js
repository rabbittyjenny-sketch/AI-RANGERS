/**
 * Server-side database access (Neon Postgres)
 *
 * การอ่าน/เขียนฐานข้อมูลทั้งหมดทำที่นี่ฝั่ง server เท่านั้น — browser ไม่มี connection string แล้ว
 * URL: DATABASE_URL (ใหม่) หรือ VITE_DATABASE_URL (ค่าเดิม ยังรองรับระหว่างย้าย)
 *
 * ความเป็นเจ้าของ: แบรนด์ผูกกับรหัสเครื่องของผู้ใช้ (owner_key, header x-ranger-user)
 * แต่ละคนอ่าน/แก้ได้เฉพาะแบรนด์ของตัวเอง แบรนด์เก่าที่ไม่มีเจ้าของจะไม่แสดงให้ใครเห็น
 */

let queryFn = null;
let schemaReady = null;

/** @returns {Promise<((text: string, params?: any[]) => Promise<any[]>) | null>} */
export async function getQuery() {
  if (queryFn) return queryFn;
  const url = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
  if (!url) return null;
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  queryFn = (text, params = []) => sql.query(text, params);
  return queryFn;
}

/** ใช้ในเทส */
export function setQuery(fn) {
  queryFn = fn;
  schemaReady = null;
}

/**
 * เพิ่มคอลัมน์เจ้าของให้ตาราง brands (ครั้งแรกที่ใช้) — ไม่แตะข้อมูลเดิม
 * แบรนด์เก่า owner_key = NULL จึงไม่มีใครเห็น
 */
export function ensureBrandOwnership(query) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query('ALTER TABLE brands ADD COLUMN IF NOT EXISTS owner_key text');
      await query('ALTER TABLE brands ADD COLUMN IF NOT EXISTS client_id text');
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS brands_owner_client_idx
         ON brands (owner_key, client_id) WHERE owner_key IS NOT NULL`);
    })().catch(err => { schemaReady = null; throw err; });
  }
  return schemaReady;
}

const UID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** เจ้าของต้องมีรหัสเครื่องเท่านั้น (ไม่ใช้ IP — คนใช้เน็ตเดียวกันจะเห็นแบรนด์กัน) */
export function ownerKeyFrom(req) {
  const uid = req.headers?.['x-ranger-user'];
  return typeof uid === 'string' && UID_PATTERN.test(uid) ? `u:${uid.toLowerCase()}` : null;
}

// ── value helpers ─────────────────────────────────────────────────────────────

export function str(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export function strArray(v, maxItems = 20, maxLen = 200) {
  const arr = Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
  return arr.map(x => String(x ?? '').trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
}

export function readBody(req) {
  return req.body && typeof req.body === 'object' ? req.body : {};
}
