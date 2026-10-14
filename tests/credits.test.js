// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import {
  bangkokDay,
  nextResetIso,
  creditCost,
  userKeyFrom,
  createMemoryStore,
  createSqlStore,
  withFallback,
} from '../api/_lib/credits.js';

const cfg = { dailyCredits: 30, dailyUserCap: 20, ipDailyUserLimit: 5, retriesPerTurn: 2, enabled: true };
const DAY = '2026-10-14';

describe('credit helpers', () => {
  it('rolls the day over at midnight Bangkok time, not UTC', () => {
    expect(bangkokDay(new Date('2026-10-14T16:59:59Z'))).toBe('2026-10-14'); // 23:59:59 ไทย
    expect(bangkokDay(new Date('2026-10-14T17:00:00Z'))).toBe('2026-10-15'); // 00:00 ไทย
    expect(nextResetIso(new Date('2026-10-14T06:00:00Z'))).toBe('2026-10-14T17:00:00.000Z');
    expect(nextResetIso(new Date('2026-10-14T17:30:00Z'))).toBe('2026-10-15T17:00:00.000Z');
  });

  it('charges 1 for text and 2 when the latest message has an attachment', () => {
    expect(creditCost([{ role: 'user', content: 'สวัสดี' }])).toBe(1);
    expect(creditCost([{ role: 'user', content: [{ type: 'text', text: 'ดูรูป' }] }])).toBe(1);
    expect(creditCost([{ role: 'user', content: [{ type: 'text', text: 'ดูรูป' }, { type: 'image' }] }])).toBe(2);
  });

  it('identifies users by device id, falling back to IP', () => {
    const uid = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(userKeyFrom({ headers: { 'x-ranger-user': uid } })).toBe(`u:${uid}`);
    expect(userKeyFrom({ headers: { 'x-ranger-user': 'not-a-uuid', 'x-forwarded-for': '1.2.3.4' } })).toBe('ip:1.2.3.4');
  });
});

/** ชุดเทสต์เดียวกัน รันกับทั้ง memory store และ Postgres จริง */
function storeContract(makeStore) {
  let store;
  beforeAll(async () => { store = await makeStore(); });

  it('charges until the daily limit, then refuses without going over', async () => {
    const userKey = 'u:a';
    for (let i = 0; i < 14; i++) await store.reserve({ userKey, ip: '1.1.1.1', cost: 2, day: DAY, cfg });
    const r1 = await store.reserve({ userKey, ip: '1.1.1.1', cost: 2, day: DAY, cfg });
    expect(r1).toMatchObject({ ok: true, used: 30 });
    const r2 = await store.reserve({ userKey, ip: '1.1.1.1', cost: 1, day: DAY, cfg });
    expect(r2).toMatchObject({ ok: false, reason: 'quota_exceeded', used: 30 });
    expect(await store.peek({ userKey, day: DAY, cfg })).toEqual({ used: 30, remaining: 0 });
  });

  it('refunds, and a new day starts from zero', async () => {
    await store.refund({ userKey: 'u:a', cost: 2, day: DAY });
    expect((await store.peek({ userKey: 'u:a', day: DAY, cfg })).used).toBe(28);
    expect((await store.peek({ userKey: 'u:a', day: '2026-10-15', cfg })).used).toBe(0);
  });

  it('limits new users per IP and per day', async () => {
    const day = '2026-11-01';
    const small = { ...cfg, dailyUserCap: 3, ipDailyUserLimit: 2 };
    expect((await store.reserve({ userKey: 'u:1', ip: '9.9.9.9', cost: 1, day, cfg: small })).ok).toBe(true);
    expect((await store.reserve({ userKey: 'u:2', ip: '9.9.9.9', cost: 1, day, cfg: small })).ok).toBe(true);
    expect(await store.reserve({ userKey: 'u:3', ip: '9.9.9.9', cost: 1, day, cfg: small }))
      .toMatchObject({ ok: false, reason: 'ip_user_limit' });
    expect((await store.reserve({ userKey: 'u:3', ip: '8.8.8.8', cost: 1, day, cfg: small })).ok).toBe(true);
    expect(await store.reserve({ userKey: 'u:4', ip: '7.7.7.7', cost: 1, day, cfg: small }))
      .toMatchObject({ ok: false, reason: 'daily_user_cap' });
    // ผู้ใช้เดิมยังใช้ต่อได้แม้เต็มแล้ว
    expect((await store.reserve({ userKey: 'u:1', ip: '9.9.9.9', cost: 1, day, cfg: small })).ok).toBe(true);
  });

  it('allows 2 free retries per turn, only for the same user and day', async () => {
    const turnId = await store.openTurn({ userKey: 'u:a', day: DAY });
    expect(await store.useTurnRetry({ turnId, userKey: 'u:b', day: DAY, cfg })).toBe(false);
    expect(await store.useTurnRetry({ turnId, userKey: 'u:a', day: DAY, cfg })).toBe(true);
    expect(await store.useTurnRetry({ turnId, userKey: 'u:a', day: DAY, cfg })).toBe(true);
    expect(await store.useTurnRetry({ turnId, userKey: 'u:a', day: DAY, cfg })).toBe(false);
    expect(await store.useTurnRetry({ turnId: 'made-up', userKey: 'u:a', day: DAY, cfg })).toBe(false);
  });

  it('never exceeds the limit under concurrent requests', async () => {
    const day = '2026-12-01';
    const results = await Promise.all(
      Array.from({ length: 40 }, () => store.reserve({ userKey: 'u:race', ip: '5.5.5.5', cost: 1, day, cfg })));
    expect(results.filter(r => r.ok)).toHaveLength(30);
    expect((await store.peek({ userKey: 'u:race', day, cfg })).used).toBe(30);
  });
}

describe('memory credit store', () => {
  storeContract(() => createMemoryStore());
});

// Postgres จริง (SQL เดียวกับที่รันบน Neon) — ต้องมี CREDITS_TEST_PG_URL
const PG_URL = process.env.CREDITS_TEST_PG_URL;
describe.runIf(PG_URL)('postgres credit store', () => {
  let sql;
  beforeAll(async () => {
    sql = postgres(PG_URL, { max: 5, onnotice: () => {} });
    await sql.unsafe('DROP TABLE IF EXISTS ranger_credit_usage, ranger_credit_turns');
  });
  afterAll(async () => { await sql?.end(); });

  storeContract(() => createSqlStore((text, params = []) => sql.unsafe(text, params)));
});

describe('withFallback', () => {
  it('keeps working on the memory store when the database errors', async () => {
    const broken = new Proxy({ kind: 'broken' }, {
      get: (t, k) => (k === 'kind' ? 'broken' : async () => { throw new Error('db down'); }),
    });
    const origError = console.error;
    console.error = () => {};
    try {
      const s = withFallback(broken, createMemoryStore());
      expect((await s.reserve({ userKey: 'u:x', ip: '1.1.1.1', cost: 1, day: DAY, cfg })).ok).toBe(true);
      expect((await s.peek({ userKey: 'u:x', day: DAY, cfg })).used).toBe(1);
    } finally {
      console.error = origError;
    }
  });
});
