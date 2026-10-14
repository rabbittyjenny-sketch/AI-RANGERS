/**
 * Vercel Serverless Function — ยอดเครดิตวันนี้ของผู้ใช้
 *
 * Route: GET /api/credits   (header x-ranger-user = รหัสเครื่อง)
 * ตอบ: { enabled, used, remaining, limit, resetsAt, filesUsed, filesLimit }
 */

import { isAllowedOrigin, sendError } from './_lib/claude.js';
import { creditConfig, getCreditStore, bangkokDay, nextResetIso, userKeyFrom } from './_lib/credits.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'method_not_allowed', 'Method not allowed');
  if (!isAllowedOrigin(req)) return sendError(res, 403, 'forbidden_origin', 'Origin not allowed');

  const cfg = creditConfig();
  if (!cfg.enabled) return res.status(200).json({ enabled: false });

  const store = await getCreditStore();
  const { used, remaining, files } = await store.peek({ userKey: userKeyFrom(req), day: bangkokDay(), cfg });
  return res.status(200).json({
    enabled: true, used, remaining, limit: cfg.dailyCredits, resetsAt: nextResetIso(),
    filesUsed: files ?? 0, filesLimit: cfg.dailyFiles,
  });
}
