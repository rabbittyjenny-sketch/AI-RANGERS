/**
 * ระบบเครดิตรายวัน (แนว Lovable) — นับฝั่ง server
 *
 * - ผู้ใช้แต่ละคนได้ DAILY_CREDITS ต่อวัน (default 30) รีเซ็ตเที่ยงคืนเวลาไทย ใช้ไม่หมดไม่สะสม
 * - ข้อความที่ได้คำตอบ = 1 เครดิต, แนบรูป/ไฟล์ = 2 เครดิต
 * - error และรอบที่ Guard สั่งแก้ (retry) ไม่หักเครดิต
 * - เพดานผู้ใช้ทั้งระบบต่อวัน DAILY_USER_CAP (default 20)
 * - กันคนสร้างตัวตนใหม่รัวๆ: IP เดียวเปิดผู้ใช้ใหม่ได้ไม่เกิน IP_DAILY_USER_LIMIT (default 5) ต่อวัน
 *
 * ระบุตัวผู้ใช้: ยังไม่มีระบบ login จึงใช้รหัสเครื่องที่ browser สุ่มเก็บไว้ (header x-ranger-user)
 * ถ้าไม่มีหรือรูปแบบผิด ใช้ IP แทน — ล้างข้อมูล browser แล้วได้ตัวตนใหม่ได้
 * แต่เพดานผู้ใช้ทั้งระบบ + เพดานต่อ IP จำกัดความเสียหายรวมไว้
 *
 * ที่เก็บ: Neon Postgres (DATABASE_URL หรือ VITE_DATABASE_URL) ตารางสร้างเองครั้งแรก
 * ถ้าไม่มี DB หรือ DB ล่ม ใช้หน่วยความจำแทน (นับแยกต่อ instance — แม่นน้อยกว่า)
 */

import { randomUUID } from 'node:crypto';
import { envInt, clientIp } from './claude.js';
import { getQuery } from './db.js';

export function creditConfig() {
  return {
    dailyCredits: envInt('DAILY_CREDITS', 30),
    // ค้นเว็บจริง = ต้นทุนสูงกว่าข้อความปกติหลายเท่า (ค่าค้น + ผลค้นที่ Claude ต้องอ่าน) จึงหักเพิ่มตามต้นทุน
    searchExtra: envInt('SEARCH_EXTRA_CREDITS', 2),
    dailyUserCap: envInt('DAILY_USER_CAP', 20),
    ipDailyUserLimit: envInt('IP_DAILY_USER_LIMIT', 5),
    retriesPerTurn: 2,
    enabled: process.env.CREDITS_ENABLED !== 'false',
  };
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** วันที่ตามเวลาไทย (YYYY-MM-DD) — ตัดรอบเที่ยงคืนเวลาไทย */
export function bangkokDay(now = new Date()) {
  return new Date(now.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** เวลารีเซ็ตครั้งถัดไป (เที่ยงคืนเวลาไทย) เป็น ISO string */
export function nextResetIso(now = new Date()) {
  const day = bangkokDay(now);
  const midnightBkkUtc = Date.parse(`${day}T00:00:00Z`) - BANGKOK_OFFSET_MS;
  return new Date(midnightBkkUtc + 24 * 60 * 60 * 1000).toISOString();
}

/** แนบรูปหรือไฟล์ (ข้อความล่าสุดมีมากกว่า 1 block) = 2 เครดิต, อื่นๆ = 1 */
export function creditCost(messages) {
  const last = messages[messages.length - 1];
  return Array.isArray(last?.content) && last.content.length > 1 ? 2 : 1;
}

const UID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function userKeyFrom(req) {
  const uid = req.headers?.['x-ranger-user'];
  if (typeof uid === 'string' && UID_PATTERN.test(uid)) return `u:${uid.toLowerCase()}`;
  return `ip:${clientIp(req)}`;
}

// ── Postgres store ────────────────────────────────────────────────────────────

const INIT_SQL = [
  `CREATE TABLE IF NOT EXISTS ranger_credit_usage (
     day date NOT NULL,
     user_key text NOT NULL,
     ip text,
     used integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (day, user_key)
   )`,
  `CREATE TABLE IF NOT EXISTS ranger_credit_turns (
     turn_id text PRIMARY KEY,
     user_key text NOT NULL,
     day date NOT NULL,
     retries integer NOT NULL DEFAULT 0,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
];

/** @param {(text: string, params?: any[]) => Promise<any[]>} query */
export function createSqlStore(query) {
  let ready = null;
  const init = () => {
    if (!ready) {
      ready = (async () => {
        for (const stmt of INIT_SQL) await query(stmt);
        // ล้าง turn เก่า (ใช้แค่กัน retry ภายในวัน)
        await query(`DELETE FROM ranger_credit_turns WHERE day < (now() AT TIME ZONE 'Asia/Bangkok')::date - 2`);
      })().catch(err => { ready = null; throw err; });
    }
    return ready;
  };

  return {
    kind: 'postgres',

    async peek({ userKey, day, cfg }) {
      await init();
      const rows = await query('SELECT used FROM ranger_credit_usage WHERE day = $1 AND user_key = $2', [day, userKey]);
      const used = rows[0] ? Number(rows[0].used) : 0;
      return { used, remaining: Math.max(cfg.dailyCredits - used, 0) };
    },

    async reserve({ userKey, ip, cost, day, cfg }) {
      await init();
      const existing = await query('SELECT used FROM ranger_credit_usage WHERE day = $1 AND user_key = $2', [day, userKey]);
      if (existing.length === 0) {
        const [{ n: users }] = await query('SELECT count(*)::int AS n FROM ranger_credit_usage WHERE day = $1', [day]);
        if (cfg.dailyUserCap > 0 && users >= cfg.dailyUserCap) return { ok: false, reason: 'daily_user_cap', used: 0 };
        const [{ n: ipUsers }] = await query(
          'SELECT count(*)::int AS n FROM ranger_credit_usage WHERE day = $1 AND ip = $2', [day, ip]);
        if (cfg.ipDailyUserLimit > 0 && ipUsers >= cfg.ipDailyUserLimit) return { ok: false, reason: 'ip_user_limit', used: 0 };
        await query(
          'INSERT INTO ranger_credit_usage (day, user_key, ip, used) VALUES ($1, $2, $3, 0) ON CONFLICT DO NOTHING',
          [day, userKey, ip]);
      }
      // จองแบบ atomic — ไม่เกินโควต้าแม้ส่งพร้อมกันหลายข้อความ
      const rows = await query(
        `UPDATE ranger_credit_usage SET used = used + $3
         WHERE day = $1 AND user_key = $2 AND used + $3 <= $4
         RETURNING used`,
        [day, userKey, cost, cfg.dailyCredits]);
      if (rows.length === 0) {
        const cur = await query('SELECT used FROM ranger_credit_usage WHERE day = $1 AND user_key = $2', [day, userKey]);
        return { ok: false, reason: 'quota_exceeded', used: cur[0] ? Number(cur[0].used) : 0 };
      }
      return { ok: true, used: Number(rows[0].used) };
    },

    async refund({ userKey, cost, day }) {
      await init();
      await query(
        'UPDATE ranger_credit_usage SET used = GREATEST(used - $3, 0) WHERE day = $1 AND user_key = $2',
        [day, userKey, cost]);
    },

    async openTurn({ userKey, day }) {
      await init();
      const turnId = randomUUID();
      await query('INSERT INTO ranger_credit_turns (turn_id, user_key, day) VALUES ($1, $2, $3)', [turnId, userKey, day]);
      return turnId;
    },

    async useTurnRetry({ turnId, userKey, day, cfg }) {
      await init();
      const rows = await query(
        `UPDATE ranger_credit_turns SET retries = retries + 1
         WHERE turn_id = $1 AND user_key = $2 AND day = $3 AND retries < $4
         RETURNING retries`,
        [turnId, userKey, day, cfg.retriesPerTurn]);
      return rows.length > 0;
    },
  };
}

// ── In-memory store (fallback / tests) ────────────────────────────────────────

export function createMemoryStore() {
  const usage = new Map(); // `${day}|${userKey}` -> { used, ip }
  const turns = new Map(); // turnId -> { userKey, day, retries }
  const key = (day, userKey) => `${day}|${userKey}`;

  return {
    kind: 'memory',

    async peek({ userKey, day, cfg }) {
      const used = usage.get(key(day, userKey))?.used || 0;
      return { used, remaining: Math.max(cfg.dailyCredits - used, 0) };
    },

    async reserve({ userKey, ip, cost, day, cfg }) {
      let row = usage.get(key(day, userKey));
      if (!row) {
        const today = [...usage.entries()].filter(([k]) => k.startsWith(`${day}|`)).map(([, v]) => v);
        if (cfg.dailyUserCap > 0 && today.length >= cfg.dailyUserCap) return { ok: false, reason: 'daily_user_cap', used: 0 };
        if (cfg.ipDailyUserLimit > 0 && today.filter(v => v.ip === ip).length >= cfg.ipDailyUserLimit) {
          return { ok: false, reason: 'ip_user_limit', used: 0 };
        }
        row = { used: 0, ip };
        usage.set(key(day, userKey), row);
      }
      if (row.used + cost > cfg.dailyCredits) return { ok: false, reason: 'quota_exceeded', used: row.used };
      row.used += cost;
      return { ok: true, used: row.used };
    },

    async refund({ userKey, cost, day }) {
      const row = usage.get(key(day, userKey));
      if (row) row.used = Math.max(row.used - cost, 0);
    },

    async openTurn({ userKey, day }) {
      const turnId = randomUUID();
      turns.set(turnId, { userKey, day, retries: 0 });
      return turnId;
    },

    async useTurnRetry({ turnId, userKey, day, cfg }) {
      const t = turns.get(turnId);
      if (!t || t.userKey !== userKey || t.day !== day || t.retries >= cfg.retriesPerTurn) return false;
      t.retries++;
      return true;
    },
  };
}

// ── Store selection ───────────────────────────────────────────────────────────

let store = null;
let memoryFallback = null;

/** ใช้ Postgres ถ้ามี URL; ถ้า DB ล่มระหว่างทาง สลับไปใช้หน่วยความจำ (และ log ไว้) */
export async function getCreditStore() {
  if (store) return store;
  const query = await getQuery();
  if (!query) {
    console.warn('[credits] no DATABASE_URL — using in-memory credit store');
    store = createMemoryStore();
    return store;
  }
  const primary = createSqlStore(query);
  memoryFallback = createMemoryStore();
  store = withFallback(primary, memoryFallback);
  return store;
}

export function withFallback(primary, fallback) {
  const wrap = (name) => async (args) => {
    try {
      return await primary[name](args);
    } catch (err) {
      console.error(`[credits] ${name} failed on ${primary.kind}, using memory:`, String(err?.message || err).slice(0, 200));
      return fallback[name](args);
    }
  };
  return {
    kind: `${primary.kind}+fallback`,
    peek: wrap('peek'),
    reserve: wrap('reserve'),
    refund: wrap('refund'),
    openTurn: wrap('openTurn'),
    useTurnRetry: wrap('useTurnRetry'),
  };
}

/** ใช้ในเทส */
export function setCreditStore(s) {
  store = s;
}
