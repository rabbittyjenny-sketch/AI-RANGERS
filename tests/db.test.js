// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { setQuery } from '../api/_lib/db.js';
import { resetRateLimits } from '../api/_lib/claude.js';
import brandsHandler from '../api/brands.js';
import messagesHandler from '../api/messages.js';

const A = '0f8fad5b-d9cb-469f-a165-70867728950e';
const B = '1f8fad5b-d9cb-469f-a165-70867728950e';

function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

async function call(handler, { method = 'GET', uid, body, url = '/' } = {}) {
  const res = mockRes();
  const headers = { host: 'x.vercel.app', 'x-forwarded-for': '1.1.1.1' };
  if (uid) headers['x-ranger-user'] = uid;
  await handler({ method, headers, body, url }, res);
  return res;
}

describe('without a database', () => {
  it('reports db_not_configured instead of failing', async () => {
    setQuery(null);
    const saved = { d: process.env.DATABASE_URL, v: process.env.VITE_DATABASE_URL };
    delete process.env.DATABASE_URL;
    delete process.env.VITE_DATABASE_URL;
    try {
      const r = await call(brandsHandler, { uid: A });
      expect(r.statusCode).toBe(503);
      expect(r.body.error.code).toBe('db_not_configured');
    } finally {
      if (saved.d) process.env.DATABASE_URL = saved.d;
      if (saved.v) process.env.VITE_DATABASE_URL = saved.v;
    }
  });
});

// Postgres จริง — ตารางตาม schema เดิม (ก่อนมี owner_key) เพื่อทดสอบการ migrate ด้วย
const PG_URL = process.env.CREDITS_TEST_PG_URL;
describe.runIf(PG_URL)('brands & messages ownership (postgres)', () => {
  let sql;
  beforeAll(async () => {
    sql = postgres(PG_URL, { max: 3, onnotice: () => {} });
    await sql.unsafe(`DROP TABLE IF EXISTS messages, brands`);
    await sql.unsafe(`CREATE TABLE brands (
      id serial PRIMARY KEY,
      brand_name_en varchar(255) NOT NULL, brand_name_th varchar(255) NOT NULL, industry varchar(255) NOT NULL,
      business_model varchar(50), core_usp jsonb, competitors jsonb, tax_id varchar(50), company_address text,
      primary_color varchar(7), secondary_colors jsonb, font_family jsonb, mood_keywords jsonb, video_style text,
      forbidden_elements jsonb, logo_url text, tone_of_voice varchar(255), target_audience text, target_persona text,
      pain_points jsonb, multilingual_level varchar(50), forbidden_words jsonb, brand_hashtags jsonb,
      automation_email varchar(255), automation_line_oa varchar(255),
      created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL)`);
    await sql.unsafe(`CREATE TABLE messages (
      id serial PRIMARY KEY, brand_id integer NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      role varchar(20) NOT NULL, agent_id varchar(100), agent_name varchar(255), content text NOT NULL,
      attachments jsonb, confidence integer, validation_results jsonb, created_at timestamp DEFAULT now() NOT NULL)`);
    // แบรนด์เก่าที่บันทึกก่อนมีระบบเจ้าของ
    await sql.unsafe(`INSERT INTO brands (brand_name_en, brand_name_th, industry, tax_id)
      VALUES ('Legacy', 'แบรนด์เก่า', 'food', '0105555555555')`);
    setQuery((text, params = []) => sql.unsafe(text, params));
  });
  afterAll(async () => { setQuery(null); await sql?.end(); });
  beforeEach(() => resetRateLimits());

  const brand = (over = {}) => ({
    id: '1791959706078.42', brandNameTh: 'ร้านกาแฟดี', brandNameEn: 'Good Coffee', industry: 'food',
    coreUsp: ['ออร์แกนิก', 'คั่วสด'], forbiddenWords: ['ถูกที่สุด'], toneOfVoice: 'friendly',
    primaryColor: '#5E9BEB', taxId: '0105555000000', ...over,
  });

  it('requires a device id', async () => {
    expect((await call(brandsHandler, {})).statusCode).toBe(400);
    expect((await call(brandsHandler, { uid: 'not-a-uuid' })).statusCode).toBe(400);
  });

  it('never shows legacy ownerless brands to anyone', async () => {
    const r = await call(brandsHandler, { uid: A });
    expect(r.statusCode).toBe(200);
    expect(r.body.brands).toEqual([]);
  });

  it('saves a brand once and updates it in place on re-save', async () => {
    const first = await call(brandsHandler, { method: 'POST', uid: A, body: brand() });
    expect(first.statusCode).toBe(200);
    expect(first.body.brand).toMatchObject({ id: '1791959706078.42', brandNameTh: 'ร้านกาแฟดี', coreUsp: ['ออร์แกนิก', 'คั่วสด'] });
    await call(brandsHandler, { method: 'POST', uid: A, body: brand({ toneOfVoice: 'premium' }) });
    const list = await call(brandsHandler, { uid: A });
    expect(list.body.brands).toHaveLength(1);
    expect(list.body.brands[0].toneOfVoice).toBe('premium');
  });

  it("keeps each owner's brands private, even with the same client id", async () => {
    expect((await call(brandsHandler, { uid: B })).body.brands).toEqual([]);
    await call(brandsHandler, { method: 'POST', uid: B, body: brand({ brandNameTh: 'ของ B' }) });
    const a = await call(brandsHandler, { uid: A });
    const b = await call(brandsHandler, { uid: B });
    expect(a.body.brands.map(x => x.brandNameTh)).toEqual(['ร้านกาแฟดี']);
    expect(b.body.brands.map(x => x.brandNameTh)).toEqual(['ของ B']);
  });

  it('only lets an owner write and read messages on their own brand', async () => {
    const post = (uid, content) => call(messagesHandler, {
      method: 'POST', uid, body: { brandId: '1791959706078.42', role: 'user', content, agentId: 'content-creator' } });
    expect((await post(A, 'ข้อความของ A')).statusCode).toBe(200);
    expect((await post(B, 'ข้อความของ B')).statusCode).toBe(200); // แบรนด์ของ B เอง (client id เดียวกันได้)

    const readA = await call(messagesHandler, { uid: A, url: '/api/messages?brandId=1791959706078.42&limit=10' });
    expect(readA.body.messages.map(m => m.content)).toEqual(['ข้อความของ A']);

    const stranger = '2f8fad5b-d9cb-469f-a165-70867728950e';
    expect((await post(stranger, 'แอบเขียน')).statusCode).toBe(404);
    const readStranger = await call(messagesHandler, { uid: stranger, url: '/api/messages?brandId=1791959706078.42' });
    expect(readStranger.body.messages).toEqual([]);
  });

  it('caps brands per owner and rejects incomplete input', async () => {
    expect((await call(brandsHandler, { method: 'POST', uid: A, body: { id: 'x' } })).statusCode).toBe(400);
    for (let i = 0; i < 9; i++) {
      await call(brandsHandler, { method: 'POST', uid: A, body: brand({ id: `extra-${i}` }) });
    }
    const over = await call(brandsHandler, { method: 'POST', uid: A, body: brand({ id: 'one-too-many' }) });
    expect(over.body.error.code).toBe('too_many_brands');
    // แก้แบรนด์ที่มีอยู่แล้วยังทำได้
    expect((await call(brandsHandler, { method: 'POST', uid: A, body: brand({ id: 'extra-0' }) })).statusCode).toBe(200);
  });
});
