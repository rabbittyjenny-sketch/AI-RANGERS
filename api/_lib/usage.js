/**
 * บันทึกการใช้งานรายน้อง — เพื่อวัดผลว่าคนใช้ Ranger ตัวไหนมากที่สุด
 *
 * เก็บแค่: วัน, ตัวน้อง, รหัสผู้ใช้แบบแฮช, จำนวนข้อความ — ไม่เก็บเนื้อหาแชท ไม่เก็บไฟล์แนบ
 * รหัสผู้ใช้เป็นแฮช (ย้อนกลับไม่ได้ และไม่ตรงกับรหัสในตารางเครดิต) ใช้นับ "กี่คน" เท่านั้น
 * บันทึกไม่สำเร็จ/ไม่มีฐานข้อมูล = ข้ามเงียบๆ ไม่กระทบการแชท
 */

import { createHash } from 'node:crypto';
import { getQuery } from './db.js';

export const USAGE_TABLE = 'ranger_usage_log';

/** id ของน้องทุกตัว (ตรงกับ src/data/agents.ts) — อย่างอื่นนับเป็น 'other' กันคนส่งชื่อมั่วมาเพิ่มแถว */
export const KNOWN_AGENTS = [
  'brand-builder', 'content-creator', 'campaign-planner', 'business-planner', 'market-insight', 'advisor',
];

export function normalizeAgent(v) {
  return typeof v === 'string' && KNOWN_AGENTS.includes(v) ? v : 'other';
}

export function hashUser(userKey) {
  return createHash('sha256').update(`ranger-usage|${userKey}`).digest('hex').slice(0, 16);
}

let readyFor = null;
let ready = null;

async function ensureTable(query) {
  if (readyFor !== query) {
    readyFor = query;
    ready = query(
      `CREATE TABLE IF NOT EXISTS ${USAGE_TABLE} (
         day date NOT NULL,
         agent_id text NOT NULL,
         user_hash text NOT NULL,
         messages integer NOT NULL DEFAULT 0,
         PRIMARY KEY (day, agent_id, user_hash)
       )`).catch(err => { readyFor = null; throw err; });
  }
  return ready;
}

/** นับ 1 ข้อความที่ได้คำตอบแล้ว ให้น้อง agent ของผู้ใช้ userKey ในวัน day */
export async function logUsage({ agent, userKey, day }) {
  try {
    const query = await getQuery();
    if (!query) return;
    await ensureTable(query);
    await query(
      `INSERT INTO ${USAGE_TABLE} (day, agent_id, user_hash, messages) VALUES ($1, $2, $3, 1)
       ON CONFLICT (day, agent_id, user_hash) DO UPDATE SET messages = ${USAGE_TABLE}.messages + 1`,
      [day, normalizeAgent(agent), hashUser(userKey)]);
  } catch (err) {
    console.error('[usage] log failed:', String(err?.message || err).slice(0, 200));
  }
}
