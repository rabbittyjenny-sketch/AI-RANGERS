/**
 * Vercel Serverless Function — ประวัติแชท
 *
 * GET  /api/messages?brandId=<clientId>&limit=20  → ข้อความของแบรนด์ตัวเองเท่านั้น
 * POST /api/messages                              → บันทึกข้อความ (แบรนด์ต้องเป็นของผู้ส่ง)
 */

import { isAllowedOrigin, sendError, clientIp, takeRateLimit } from './_lib/claude.js';
import { getQuery, ensureRangerTables, BRANDS_TABLE, MESSAGES_TABLE, ownerKeyFrom, str, readBody } from './_lib/db.js';

const MAX_CONTENT = 50000;

async function ownedBrandId(query, ownerKey, clientId) {
  const rows = await query(`SELECT id FROM ${BRANDS_TABLE} WHERE owner_key = $1 AND client_id = $2`, [ownerKey, clientId]);
  return rows[0]?.id ?? null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 405, 'method_not_allowed', 'Method not allowed');
  }
  if (!isAllowedOrigin(req)) return sendError(res, 403, 'forbidden_origin', 'Origin not allowed');
  const ownerKey = ownerKeyFrom(req);
  if (!ownerKey) return sendError(res, 400, 'missing_device_id', 'ต้องมีรหัสเครื่อง');
  if (!takeRateLimit('db', clientIp(req), 600)) return sendError(res, 429, 'rate_limited', 'เรียกถี่เกินไป');

  const query = await getQuery();
  if (!query) return sendError(res, 503, 'db_not_configured', 'ยังไม่ได้ตั้งค่าฐานข้อมูล');

  try {
    await ensureRangerTables(query);

    if (req.method === 'GET') {
      const url = new URL(req.url || '/', 'http://local');
      const clientId = str(req.query?.brandId ?? url.searchParams.get('brandId'), 64);
      const limit = Math.min(Math.max(parseInt(req.query?.limit ?? url.searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
      if (!clientId) return sendError(res, 400, 'invalid_request', 'ต้องมี brandId');
      const brandId = await ownedBrandId(query, ownerKey, clientId);
      if (!brandId) return res.status(200).json({ messages: [] });
      const rows = await query(
        `SELECT role, agent_id, agent_name, content, attachments, confidence, created_at
         FROM ${MESSAGES_TABLE} WHERE brand_id = $1 ORDER BY created_at DESC LIMIT $2`, [brandId, limit]);
      return res.status(200).json({
        messages: rows.reverse().map(r => ({
          brandId: clientId,
          role: r.role,
          agentId: r.agent_id ?? undefined,
          agentName: r.agent_name ?? undefined,
          content: r.content,
          attachments: Array.isArray(r.attachments) ? r.attachments : (() => { try { return JSON.parse(r.attachments) || []; } catch { return []; } })(),
          confidence: r.confidence ?? undefined,
          createdAt: r.created_at,
        })),
      });
    }

    const b = readBody(req);
    const clientId = str(b.brandId, 64);
    const content = typeof b.content === 'string' ? b.content.slice(0, MAX_CONTENT) : '';
    const role = b.role === 'user' || b.role === 'agent' ? b.role : null;
    if (!clientId || !content.trim() || !role) return sendError(res, 400, 'invalid_request', 'ข้อมูลไม่ครบ');

    const brandId = await ownedBrandId(query, ownerKey, clientId);
    if (!brandId) return sendError(res, 404, 'brand_not_found', 'ไม่พบแบรนด์');

    const attachments = Array.isArray(b.attachments)
      ? b.attachments.slice(0, 10).map(a => ({ name: str(a?.name, 255), type: str(a?.type, 100), size: Number(a?.size) || 0 }))
      : [];
    await query(
      `INSERT INTO ${MESSAGES_TABLE} (brand_id, role, agent_id, agent_name, content, attachments)
       VALUES ($1, $2, $3, $4, $5, $6::text::jsonb)`,
      [brandId, role, str(b.agentId, 100), str(b.agentName, 255), content, JSON.stringify(attachments)]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/messages]', String(err?.message || err).slice(0, 300));
    return sendError(res, 503, 'db_error', 'ฐานข้อมูลไม่พร้อม');
  }
}
