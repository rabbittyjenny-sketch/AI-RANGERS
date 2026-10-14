/**
 * Vercel Serverless Function — แบรนด์ของผู้ใช้
 *
 * GET  /api/brands   → แบรนด์ของเจ้าของรหัสเครื่องนี้เท่านั้น
 * POST /api/brands   → บันทึก/อัปเดตแบรนด์ (คีย์ = owner + clientId จาก browser — ไม่สร้างซ้ำ)
 *
 * ต้องส่ง header x-ranger-user (รหัสเครื่อง) — ไม่มีก็อ่าน/เขียนไม่ได้
 */

import { isAllowedOrigin, sendError, clientIp, takeRateLimit } from './_lib/claude.js';
import { getQuery, ensureBrandOwnership, ownerKeyFrom, str, strArray, readBody } from './_lib/db.js';

export const MAX_BRANDS_PER_OWNER = 10;

const BRAND_COLUMNS = `client_id, brand_name_en, brand_name_th, industry, business_model, core_usp, competitors,
  tax_id, company_address, primary_color, secondary_colors, font_family, mood_keywords, video_style,
  forbidden_elements, logo_url, tone_of_voice, target_audience, target_persona, pain_points,
  multilingual_level, forbidden_words, brand_hashtags, automation_email, automation_line_oa,
  created_at, updated_at`;

/** แปลงแถวในฐานข้อมูลเป็น BrandRecord — id ที่ browser เห็นคือ clientId ของมันเอง */
export function rowToBrand(r) {
  const arr = v => {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
    return Array.isArray(v) ? v : [];
  };
  return {
    id: r.client_id,
    brandNameEn: r.brand_name_en,
    brandNameTh: r.brand_name_th,
    industry: r.industry,
    businessModel: r.business_model ?? undefined,
    coreUsp: arr(r.core_usp),
    competitors: arr(r.competitors),
    taxId: r.tax_id ?? undefined,
    companyAddress: r.company_address ?? undefined,
    primaryColor: r.primary_color ?? undefined,
    secondaryColors: arr(r.secondary_colors),
    fontFamily: arr(r.font_family),
    moodKeywords: arr(r.mood_keywords),
    videoStyle: r.video_style ?? undefined,
    forbiddenElements: arr(r.forbidden_elements),
    logoUrl: r.logo_url ?? undefined,
    toneOfVoice: r.tone_of_voice ?? undefined,
    targetAudience: r.target_audience ?? undefined,
    targetPersona: r.target_persona ?? undefined,
    painPoints: arr(r.pain_points),
    multilingualLevel: r.multilingual_level ?? undefined,
    forbiddenWords: arr(r.forbidden_words),
    brandHashtags: arr(r.brand_hashtags),
    automationEmail: r.automation_email ?? undefined,
    automationLineOa: r.automation_line_oa ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function brandParams(ownerKey, b) {
  const clientId = str(b.id ?? b.clientId, 64);
  const nameTh = str(b.brandNameTh, 255);
  if (!clientId || !nameTh) return null;
  const json = v => JSON.stringify(v);
  return [
    ownerKey,                                        // $1
    clientId,                                        // $2
    str(b.brandNameEn, 255) || nameTh,               // $3
    nameTh,                                          // $4
    str(b.industry, 255) || 'other',                 // $5
    str(b.businessModel, 50),                        // $6
    json(strArray(b.coreUsp, 5)),                    // $7
    json(strArray(b.competitors, 10)),               // $8
    str(b.taxId, 50),                                // $9
    str(b.companyAddress, 1000),                     // $10
    /^#[0-9a-f]{6}$/i.test(String(b.primaryColor || '')) ? b.primaryColor : null, // $11
    json(strArray(b.secondaryColors, 5, 7)),         // $12
    json(strArray(b.fontFamily, 3, 100)),            // $13
    json(strArray(b.moodKeywords, 10, 50)),          // $14
    str(b.videoStyle, 500),                          // $15
    json(strArray(b.forbiddenElements, 20)),         // $16
    str(b.logoUrl, 1000),                            // $17
    str(b.toneOfVoice, 255),                         // $18
    str(b.targetAudience, 2000),                     // $19
    str(b.targetPersona, 2000),                      // $20
    json(strArray(b.painPoints, 10)),                // $21
    str(b.multilingualLevel, 50),                    // $22
    json(strArray(b.forbiddenWords, 50, 100)),       // $23
    json(strArray(b.brandHashtags, 20, 100)),        // $24
    str(b.automationEmail, 255),                     // $25
    str(b.automationLineOa, 255),                    // $26
  ];
}

const UPSERT_SQL = `
  INSERT INTO brands (owner_key, client_id, brand_name_en, brand_name_th, industry, business_model,
    core_usp, competitors, tax_id, company_address, primary_color, secondary_colors, font_family,
    mood_keywords, video_style, forbidden_elements, logo_url, tone_of_voice, target_audience,
    target_persona, pain_points, multilingual_level, forbidden_words, brand_hashtags,
    automation_email, automation_line_oa, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8::text::jsonb, $9, $10, $11, $12::text::jsonb, $13::text::jsonb,
    $14::text::jsonb, $15, $16::text::jsonb, $17, $18, $19, $20, $21::text::jsonb, $22, $23::text::jsonb, $24::text::jsonb,
    $25, $26, now())
  ON CONFLICT (owner_key, client_id) WHERE owner_key IS NOT NULL DO UPDATE SET
    brand_name_en = EXCLUDED.brand_name_en, brand_name_th = EXCLUDED.brand_name_th,
    industry = EXCLUDED.industry, business_model = EXCLUDED.business_model,
    core_usp = EXCLUDED.core_usp, competitors = EXCLUDED.competitors, tax_id = EXCLUDED.tax_id,
    company_address = EXCLUDED.company_address, primary_color = EXCLUDED.primary_color,
    secondary_colors = EXCLUDED.secondary_colors, font_family = EXCLUDED.font_family,
    mood_keywords = EXCLUDED.mood_keywords, video_style = EXCLUDED.video_style,
    forbidden_elements = EXCLUDED.forbidden_elements, logo_url = EXCLUDED.logo_url,
    tone_of_voice = EXCLUDED.tone_of_voice, target_audience = EXCLUDED.target_audience,
    target_persona = EXCLUDED.target_persona, pain_points = EXCLUDED.pain_points,
    multilingual_level = EXCLUDED.multilingual_level, forbidden_words = EXCLUDED.forbidden_words,
    brand_hashtags = EXCLUDED.brand_hashtags, automation_email = EXCLUDED.automation_email,
    automation_line_oa = EXCLUDED.automation_line_oa, updated_at = now()
  RETURNING ${BRAND_COLUMNS}`;

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
    await ensureBrandOwnership(query);

    if (req.method === 'GET') {
      const rows = await query(
        `SELECT ${BRAND_COLUMNS} FROM brands WHERE owner_key = $1 ORDER BY created_at DESC LIMIT $2`,
        [ownerKey, MAX_BRANDS_PER_OWNER]);
      return res.status(200).json({ brands: rows.map(rowToBrand) });
    }

    const params = brandParams(ownerKey, readBody(req));
    if (!params) return sendError(res, 400, 'invalid_request', 'ต้องมี id และชื่อแบรนด์');

    const [{ n }] = await query(
      'SELECT count(*)::int AS n FROM brands WHERE owner_key = $1 AND client_id <> $2', [ownerKey, params[1]]);
    if (n >= MAX_BRANDS_PER_OWNER) return sendError(res, 409, 'too_many_brands', 'จำนวนแบรนด์เกินกำหนด');

    const [row] = await query(UPSERT_SQL, params);
    return res.status(200).json({ brand: rowToBrand(row) });
  } catch (err) {
    console.error('[api/brands]', String(err?.message || err).slice(0, 300));
    return sendError(res, 503, 'db_error', 'ฐานข้อมูลไม่พร้อม');
  }
}
