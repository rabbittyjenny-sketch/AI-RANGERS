// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { setQuery } from '../api/_lib/db.js';
import { resetRateLimits } from '../api/_lib/claude.js';
import brandsHandler from '../api/brands.js';

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

// Postgres จริง — จำลองฐานข้อมูลที่ใช้ร่วมกับแอปอื่น (มีตาราง messages คนละโครงสร้างอยู่แล้ว)
const PG_URL = process.env.CREDITS_TEST_PG_URL;
describe.runIf(PG_URL)('brands & messages ownership (postgres)', () => {
  let sql;
  beforeAll(async () => {
    sql = postgres(PG_URL, { max: 3, onnotice: () => {} });
    await sql.unsafe(`DROP TABLE IF EXISTS ranger_messages, ranger_brands, messages, brands`);
    await sql.unsafe(`CREATE TABLE messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid, role text, content text)`);
    await sql.unsafe(`INSERT INTO messages (role, content) VALUES ('user', 'ของแอปอื่น')`);
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

  it('creates its own ranger_ tables and leaves other apps\' tables alone', async () => {
    const r = await call(brandsHandler, { uid: A });
    expect(r.statusCode).toBe(200);
    expect(r.body.brands).toEqual([]);
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'ranger_%' ORDER BY 1`;
    expect(tables.map(t => t.table_name)).toEqual(expect.arrayContaining(['ranger_brands']));
    const foreign = await sql`SELECT content FROM messages`;
    expect(foreign.map(m => m.content)).toEqual(['ของแอปอื่น']);
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

  it('stores no chat messages at all: there is no ranger_messages table and no /api/messages', async () => {
    await call(brandsHandler, { uid: A });
    const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'ranger_messages'`;
    expect(t).toHaveLength(0);
    expect((await sql`SELECT count(*)::int AS n FROM messages`)[0].n).toBe(1); // ของแอปอื่นไม่ถูกแตะ
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
