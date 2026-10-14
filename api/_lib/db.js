/**
 * Server-side database access (Neon Postgres)
 *
 * การอ่าน/เขียนฐานข้อมูลทั้งหมดทำที่นี่ฝั่ง server เท่านั้น — browser ไม่มี connection string แล้ว
 * URL: DATABASE_URL (ใหม่) หรือ VITE_DATABASE_URL (ค่าเดิม ยังรองรับระหว่างย้าย)
 *
 * ความเป็นเจ้าของ: แบรนด์ผูกกับรหัสเครื่องของผู้ใช้ (owner_key, header x-ranger-user)
 * แต่ละคนอ่าน/แก้ได้เฉพาะแบรนด์ของตัวเอง
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
 * ตารางของ AI Rangers ขึ้นต้นด้วย ranger_ ทั้งหมด — ฐานข้อมูลที่ใช้ร่วม (neon-vercel-DB)
 * มีตาราง messages/users ของแอปอื่นอยู่แล้ว ห้ามแตะตารางที่ไม่ใช่ของเรา
 * สร้างเองครั้งแรกที่ใช้ (IF NOT EXISTS) — ไม่ต้องรัน migration
 */
export const BRANDS_TABLE = 'ranger_brands';

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${BRANDS_TABLE} (
    id serial PRIMARY KEY,
    owner_key text NOT NULL,
    client_id text NOT NULL,
    brand_name_en varchar(255) NOT NULL,
    brand_name_th varchar(255) NOT NULL,
    industry varchar(255) NOT NULL,
    business_model varchar(50),
    core_usp jsonb,
    competitors jsonb,
    tax_id varchar(50),
    company_address text,
    primary_color varchar(7),
    secondary_colors jsonb,
    font_family jsonb,
    mood_keywords jsonb,
    video_style text,
    forbidden_elements jsonb,
    logo_url text,
    tone_of_voice varchar(255),
    target_audience text,
    target_persona text,
    pain_points jsonb,
    multilingual_level varchar(50),
    forbidden_words jsonb,
    brand_hashtags jsonb,
    automation_email varchar(255),
    automation_line_oa varchar(255),
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    UNIQUE (owner_key, client_id)
  )`,
];

export function ensureRangerTables(query) {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA_SQL) await query(stmt);
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
