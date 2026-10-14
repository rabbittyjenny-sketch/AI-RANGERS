// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';

const create = vi.fn();
vi.mock('../api/_lib/claude.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getClient: () => ({ messages: { create } }) };
});

const { default: chatHandler, buildChatRequest, validateChatBody } = await import('../api/anthropic.js');
const { default: guardHandler, parseGuardOutput } = await import('../api/guard.js');
const { resetRateLimits, toErrorPayload, isAllowedOrigin } = await import('../api/_lib/claude.js');
const { setCreditStore, createMemoryStore } = await import('../api/_lib/credits.js');
const { default: creditsHandler } = await import('../api/credits.js');
const { setQuery } = await import('../api/_lib/db.js');
const { normalizeAgent, hashUser, KNOWN_AGENTS } = await import('../api/_lib/usage.js');

function mockRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = () => res;
  return res;
}

function mockReq(body, headers = {}, method = 'POST') {
  return { method, body, headers: { host: 'ai-rangers.vercel.app', 'x-forwarded-for': '1.2.3.4', ...headers } };
}

const okBody = { system: 'คุณคือ Ranger', messages: [{ role: 'user', content: 'สวัสดี' }] };

function apiError(Cls, message = 'err') {
  const e = Object.create(Cls.prototype);
  e.message = message;
  return e;
}

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'CLAUDE_MODEL', 'CLAUDE_EFFORT', 'CHAT_MAX_TOKENS', 'WEB_SEARCH_MAX_USES',
  'CHAT_RATE_LIMIT', 'GUARD_AI_ENABLED', 'GUARD_MODEL', 'ALLOWED_ORIGINS',
  'DAILY_CREDITS', 'DAILY_USER_CAP', 'IP_DAILY_USER_LIMIT', 'CREDITS_ENABLED'];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  resetRateLimits();
  setCreditStore(createMemoryStore());
  create.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('/api/anthropic', () => {
  it('rejects non-POST', async () => {
    const res = mockRes();
    await chatHandler(mockReq(okBody, {}, 'GET'), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a foreign Origin but allows same host and ALLOWED_ORIGINS', async () => {
    expect(isAllowedOrigin(mockReq(okBody, { origin: 'https://evil.example' }))).toBe(false);
    expect(isAllowedOrigin(mockReq(okBody, { origin: 'https://ai-rangers.vercel.app' }))).toBe(true);
    process.env.ALLOWED_ORIGINS = 'https://rangers.example.com';
    expect(isAllowedOrigin(mockReq(okBody, { origin: 'https://rangers.example.com' }))).toBe(true);

    const res = mockRes();
    await chatHandler(mockReq(okBody, { origin: 'https://evil.example' }), res);
    expect(res.statusCode).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 500 not_configured without an API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = mockRes();
    await chatHandler(mockReq(okBody), res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('not_configured');
  });

  it('validates body shape', () => {
    expect(validateChatBody({ system: 's', messages: [{ role: 'system', content: 'x' }] }).ok).toBe(false);
    expect(validateChatBody({ system: 's', messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }).ok).toBe(false);
    expect(validateChatBody({ system: 's', messages: [{ role: 'user', content: [{ type: 'document', source: {} }] }] }).ok).toBe(false);
    expect(validateChatBody({ system: '', messages: [{ role: 'user', content: 'a' }] }).ok).toBe(false);
    const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } };
    expect(validateChatBody({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดูรูป' }, img] }] }).ok).toBe(true);
  });

  it('ignores model/max_tokens/tools sent by the browser and uses server defaults', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'ตอบ' }], stop_reason: 'end_turn', model: 'claude-haiku-5-5', usage: {} });
    const res = mockRes();
    await chatHandler(mockReq({ ...okBody, model: 'claude-fable-5-1', max_tokens: 128000, tools: [] }), res);

    expect(res.statusCode).toBe(200);
    const sent = create.mock.calls[0][0];
    expect(sent.model).toBe('claude-sonnet-4-6');
    expect(sent.max_tokens).toBe(4096);
    expect(sent.output_config).toBeUndefined(); // ไม่ส่ง effort เหมือนก่อนหน้า
    expect(sent.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }]); // ค้นหาข้อมูลภายนอกได้ ไม่เกิน 2 ครั้งต่อข้อความ
    expect(sent.temperature).toBeUndefined();
  });

  it('web search can be switched off with WEB_SEARCH_MAX_USES=0', () => {
    process.env.WEB_SEARCH_MAX_USES = '0';
    expect(buildChatRequest('SYS', [{ role: 'user', content: 'q' }]).tools).toBeUndefined();
  });

  it('returns only real cited sources (deduped, max 3) and never invents any', async () => {
    const cite = (url, title) => ({ type: 'web_search_result_location', url, title, cited_text: 'x' });
    create.mockResolvedValue({
      content: [
        { type: 'server_tool_use', name: 'web_search', input: { query: 'q' } },
        { type: 'text', text: 'ตลาดโต ', citations: [cite('https://a.com/1', 'A'), cite('https://a.com/1', 'A again')] },
        { type: 'text', text: 'ต่อเนื่อง', citations: [cite('https://b.com/2', 'B'), cite('ftp://bad', 'bad'), cite('https://c.com/3', 'C'), cite('https://d.com/4', 'D')] },
      ],
      stop_reason: 'end_turn', model: 'claude-sonnet-4-6', usage: { server_tool_use: { web_search_requests: 1 } },
    });
    const res = mockRes();
    await chatHandler(mockReq(okBody), res);
    expect(res.body.text).toBe('ตลาดโต ต่อเนื่อง');
    expect(res.body.sources).toEqual([
      { title: 'A', url: 'https://a.com/1' },
      { title: 'B', url: 'https://b.com/2' },
      { title: 'C', url: 'https://c.com/3' },
    ]);
  });

  it('returns no sources when Claude did not search', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'ตอบเอง' }], stop_reason: 'end_turn', model: 'm', usage: {} });
    const res = mockRes();
    await chatHandler(mockReq(okBody), res);
    expect(res.body.sources).toEqual([]);
  });

  it('marks system prompt and last message for prompt caching', () => {
    const req = buildChatRequest('SYS', [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ]);
    expect(req.system).toEqual([{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }]);
    expect(req.messages[0]).toEqual({ role: 'user', content: 'q1' });
    expect(req.messages[2].content).toEqual([{ type: 'text', text: 'q2', cache_control: { type: 'ephemeral' } }]);
  });

  it('respects env overrides', () => {
    process.env.CLAUDE_MODEL = 'claude-sonnet-5-5';
    process.env.CLAUDE_EFFORT = 'none';
    process.env.WEB_SEARCH_MAX_USES = '3';
    process.env.CHAT_MAX_TOKENS = '2000';
    const req = buildChatRequest('SYS', [{ role: 'user', content: 'q' }]);
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req.output_config).toBeUndefined();
    expect(req.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]);
    expect(req.max_tokens).toBe(2000);
  });

  it('rate-limits per IP', async () => {
    process.env.CHAT_RATE_LIMIT = '2';
    create.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: {} });
    const codes = [];
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      await chatHandler(mockReq(okBody), res);
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([200, 200, 429]);
    const other = mockRes();
    await chatHandler(mockReq(okBody, { 'x-forwarded-for': '9.9.9.9' }), other);
    expect(other.statusCode).toBe(200);
  });

  it('continues a pause_turn and joins the text', async () => {
    create
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'ส่วนแรก ' }], stop_reason: 'pause_turn', usage: { input_tokens: 10, output_tokens: 5 } })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'ส่วนสอง' }], stop_reason: 'end_turn', usage: { input_tokens: 3, output_tokens: 2, server_tool_use: { web_search_requests: 1 } } });
    const res = mockRes();
    await chatHandler(mockReq(okBody), res);
    expect(res.body.text).toBe('ส่วนแรก ส่วนสอง');
    expect(res.body.usage.input_tokens).toBe(13);
    expect(res.body.usage.web_search_requests).toBe(1);
    const second = create.mock.calls[1][0];
    expect(second.messages.at(-1).role).toBe('assistant');
  });

  it('maps upstream errors to codes the UI understands', async () => {
    expect(toErrorPayload(apiError(Anthropic.AuthenticationError)).code).toBe('auth');
    expect(toErrorPayload(apiError(Anthropic.RateLimitError)).code).toBe('upstream_rate_limited');
    expect(toErrorPayload(apiError(Anthropic.BadRequestError, 'Your credit balance is too low')).code).toBe('billing');
    expect(toErrorPayload(apiError(Anthropic.InternalServerError)).code).toBe('overloaded');
    expect(toErrorPayload(new Error('x')).code).toBe('internal');

    create.mockRejectedValue(apiError(Anthropic.AuthenticationError));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    await chatHandler(mockReq(okBody), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('auth');
  });
});

describe('daily credits on /api/anthropic', () => {
  const UID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const ok = { content: [{ type: 'text', text: 'ตอบ' }], stop_reason: 'end_turn', usage: {} };
  const img = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } };

  async function send(body, headers = { 'x-ranger-user': UID }) {
    const res = mockRes();
    await chatHandler(mockReq(body, headers), res);
    return res;
  }

  it('charges 1 credit per answered message and 2 with an attachment, returning a turnId', async () => {
    create.mockResolvedValue(ok);
    const r1 = await send(okBody);
    expect(r1.body.credits).toMatchObject({ cost: 1, used: 1, remaining: 29, limit: 30 });
    expect(typeof r1.body.turnId).toBe('string');
    const r2 = await send({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดูรูป' }, img] }] });
    expect(r2.body.credits).toMatchObject({ cost: 2, used: 3, remaining: 27 });
  });

  const txt = (name) => ({ type: 'text', text: `\n\n[ไฟล์แนบ: ${name}]\nเนื้อหา` });

  it('allows 3 attachments a day, counting every image and text file, and refuses the 4th without charging', async () => {
    create.mockResolvedValue(ok);
    const withFiles = (...files) => ({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดู' }, ...files] }] });
    expect((await send(withFiles(img, txt('a.txt')))).body.credits).toMatchObject({ cost: 2, used: 2, filesUsed: 2, filesLimit: 3 });
    expect((await send(withFiles(txt('b.txt')))).body.credits).toMatchObject({ used: 4, filesUsed: 3 });
    const calls = create.mock.calls.length;
    const blocked = await send(withFiles(img));
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body.error.code).toBe('file_limit');
    expect(blocked.body.error.message).toContain('3 ไฟล์');
    expect(blocked.body.credits).toMatchObject({ cost: 0, used: 4, filesUsed: 3 });
    expect(create).toHaveBeenCalledTimes(calls); // ไม่เรียก Claude และไม่หักเครดิต
    // ข้อความไม่แนบไฟล์ยังส่งได้ตามปกติ
    expect((await send(okBody)).statusCode).toBe(200);
  });

  it('does not count a plain text message, and a big text file is not cut by a character cap', async () => {
    create.mockResolvedValue(ok);
    const big = { type: 'text', text: '\n\n[ไฟล์แนบ: big.txt]\n' + 'ก'.repeat(100000) };
    const r = await send({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดู' }, big] }] });
    expect(r.statusCode).toBe(200);
    expect(r.body.credits.filesUsed).toBe(1);
  });

  it('gives the files back when the answer is refunded', async () => {
    create.mockResolvedValueOnce({ content: [], stop_reason: 'refusal', usage: {} });
    await send({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดู' }, img, img] }] });
    const bal = mockRes();
    await creditsHandler(mockReq(undefined, { 'x-ranger-user': UID }, 'GET'), bal);
    expect(bal.body).toMatchObject({ used: 0, filesUsed: 0, filesLimit: 3 });
  });

  it('DAILY_FILES=0 means no file limit', async () => {
    process.env.DAILY_FILES = '0';
    create.mockResolvedValue(ok);
    for (let i = 0; i < 4; i++) {
      expect((await send({ system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'ดู' }, img] }] })).statusCode).toBe(200);
    }
  });

  it('charges +2 only when Claude really searched the web, never below zero', async () => {
    const searched = { content: [{ type: 'text', text: 'ตอบ' }], stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 1 } } };
    create.mockResolvedValue(ok);
    expect((await send(okBody)).body.credits).toMatchObject({ cost: 1, used: 1 }); // ไม่ค้น = 1
    create.mockResolvedValue(searched);
    expect((await send(okBody)).body.credits).toMatchObject({ cost: 3, used: 4, remaining: 26 }); // ค้น = 1 + 2
    // โควตา 6 ใช้ไปแล้ว 4: ข้อความนี้ 1 + ค้นเพิ่มได้แค่ 1 ที่เหลือ (ไม่ใช่ 2) ไม่เกินโควตา
    process.env.DAILY_CREDITS = '6';
    const r = await send(okBody);
    expect(r.body.credits).toMatchObject({ cost: 2, used: 6, remaining: 0, limit: 6 });
    // เต็มแล้ว: ไม่หักเพิ่มอีก
    process.env.DAILY_CREDITS = '7';
    expect((await send(okBody)).body.credits).toMatchObject({ cost: 1, used: 7, remaining: 0 });
  });

  it('does not charge the extra for a search when the answer is refunded', async () => {
    create.mockResolvedValueOnce({ content: [], stop_reason: 'end_turn', usage: { server_tool_use: { web_search_requests: 1 } } });
    const r = await send(okBody);
    expect(r.body.credits).toBeNull();
    const bal = mockRes();
    await creditsHandler(mockReq(undefined, { 'x-ranger-user': UID }, 'GET'), bal);
    expect(bal.body.used).toBe(0);
  });

  it('does not charge guard retries that carry a valid turnId, and rejects made-up ones', async () => {
    create.mockResolvedValue(ok);
    const first = await send(okBody);
    const retry = await send({ ...okBody, turnId: first.body.turnId });
    expect(retry.statusCode).toBe(200);
    expect(retry.body.credits).toBeNull();
    expect((await send({ ...okBody, turnId: first.body.turnId })).statusCode).toBe(200);
    expect((await send({ ...okBody, turnId: first.body.turnId })).statusCode).toBe(429); // เกิน 2 รอบ
    expect((await send({ ...okBody, turnId: 'made-up' })).body.error.code).toBe('retry_not_allowed');

    const bal = mockRes();
    await creditsHandler(mockReq(undefined, { 'x-ranger-user': UID }, 'GET'), bal);
    expect(bal.body).toMatchObject({ enabled: true, used: 1, remaining: 29, limit: 30 });
  });

  it('refunds when Claude fails or returns nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(apiError(Anthropic.InternalServerError));
    expect((await send(okBody)).statusCode).toBe(503);
    create.mockResolvedValueOnce({ content: [], stop_reason: 'refusal', usage: {} });
    expect((await send(okBody)).body.credits).toBeNull();
    create.mockResolvedValueOnce(ok);
    expect((await send(okBody)).body.credits.used).toBe(1);
  });

  it('returns quota_exceeded with the balance once the day is used up', async () => {
    process.env.DAILY_CREDITS = '2';
    create.mockResolvedValue(ok);
    await send(okBody);
    await send(okBody);
    const r = await send(okBody);
    expect(r.statusCode).toBe(429);
    expect(r.body.error.code).toBe('quota_exceeded');
    expect(r.body.credits).toMatchObject({ remaining: 0, limit: 2 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('caps distinct users per day', async () => {
    process.env.DAILY_USER_CAP = '1';
    create.mockResolvedValue(ok);
    expect((await send(okBody)).statusCode).toBe(200);
    const other = await send(okBody, { 'x-ranger-user': '1f8fad5b-d9cb-469f-a165-70867728950e', 'x-forwarded-for': '6.6.6.6' });
    expect(other.body.error.code).toBe('daily_user_cap');
  });

  it('can be switched off', async () => {
    process.env.CREDITS_ENABLED = 'false';
    create.mockResolvedValue(ok);
    const r = await send(okBody);
    expect(r.body.credits).toBeNull();
    expect(r.body.turnId).toBeUndefined();
  });
});

describe('/api/guard', () => {
  const guardBody = { content: 'โพสต์ขายครีม', brand: { name: 'A', usp: 'ออร์แกนิก', tone: 'friendly' } };
  const verdicts = {
    factCheck: { verdict: 'pass', reason: 'ผ่าน' },
    uspGrounding: { verdict: 'pass', reason: 'ผ่าน' },
    referenceValidation: { verdict: 'warn', reason: 'ไม่มีแหล่งที่มา' },
    consistency: { verdict: 'pass', reason: 'ผ่าน' },
  };

  it('can be switched off with GUARD_AI_ENABLED=false', async () => {
    process.env.GUARD_AI_ENABLED = 'false';
    const res = mockRes();
    await guardHandler(mockReq(guardBody), res);
    expect(res.body).toEqual({ skipped: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('asks Haiku for schema-constrained JSON and returns the checks', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(verdicts) }], stop_reason: 'end_turn', model: 'claude-haiku-5-5', usage: {} });
    const res = mockRes();
    await guardHandler(mockReq(guardBody), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.checks.referenceValidation.verdict).toBe('warn');
    const sent = create.mock.calls[0][0];
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(sent.messages[0].content).toContain('ออร์แกนิก');
  });

  it('reports unparseable output instead of guessing', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '{"factCheck":' }], stop_reason: 'max_tokens', usage: {} });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    await guardHandler(mockReq(guardBody), res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe('guard_unparseable');
    expect(parseGuardOutput('{"factCheck":{"verdict":"maybe","reason":""}}')).toBeNull();
  });

  it('rejects empty content', async () => {
    const res = mockRes();
    await guardHandler(mockReq({ content: '  ' }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe('usage log (which Ranger is used) — counts only, never chat content', () => {
  const UID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const ok = { content: [{ type: 'text', text: 'ตอบลับเฉพาะ' }], stop_reason: 'end_turn', usage: {} };
  let sqls;
  beforeEach(() => {
    sqls = [];
    setQuery(async (text, params = []) => { sqls.push({ text, params }); return []; });
  });
  afterEach(() => setQuery(null));

  async function send(body, headers = { 'x-ranger-user': UID }) {
    const res = mockRes();
    await chatHandler(mockReq(body, headers), res);
    return res;
  }
  const inserts = () => sqls.filter(q => /INSERT INTO ranger_usage_log/.test(q.text));

  it('counts one use per answered message for the Ranger that answered', async () => {
    create.mockResolvedValue(ok);
    await send({ ...okBody, agent: 'market-insight' });
    await send({ ...okBody, agent: 'market-insight' });
    expect(inserts()).toHaveLength(2);
    const [day, agent, user] = inserts()[0].params;
    expect(day).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(agent).toBe('market-insight');
    expect(user).toBe(hashUser(`u:${UID}`));
    expect(user).not.toContain(UID);
    expect(sqls.some(q => /CREATE TABLE IF NOT EXISTS ranger_usage_log/.test(q.text))).toBe(true);
  });

  it('never stores what was said or answered', async () => {
    create.mockResolvedValue(ok);
    await send({ system: 'ระบบลับ', messages: [{ role: 'user', content: 'ข้อความลับของผู้ใช้' }], agent: 'advisor' });
    const everything = JSON.stringify(sqls);
    for (const secret of ['ข้อความลับของผู้ใช้', 'ตอบลับเฉพาะ', 'ระบบลับ', UID]) expect(everything).not.toContain(secret);
  });

  it('files an unknown or missing Ranger under "other" so nobody can add rows with made-up names', async () => {
    create.mockResolvedValue(ok);
    await send({ ...okBody, agent: 'something-made-up' });
    await send(okBody);
    expect(inserts().map(q => q.params[1])).toEqual(['other', 'other']);
    expect(normalizeAgent('brand-builder')).toBe('brand-builder');
    expect(KNOWN_AGENTS).toHaveLength(6);
  });

  it('does not count guard retries, refusals or errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockResolvedValue(ok);
    const first = await send({ ...okBody, agent: 'advisor' });
    expect(inserts()).toHaveLength(1);
    await send({ ...okBody, agent: 'advisor', turnId: first.body.turnId }); // รอบที่ guard สั่งแก้
    expect(inserts()).toHaveLength(1);
    create.mockResolvedValueOnce({ content: [], stop_reason: 'refusal', usage: {} });
    await send({ ...okBody, agent: 'advisor' });
    create.mockRejectedValueOnce(apiError(Anthropic.InternalServerError));
    await send({ ...okBody, agent: 'advisor' });
    expect(inserts()).toHaveLength(1);
  });

  it('never breaks the chat if the log fails, and is skipped without a database', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockResolvedValue(ok);
    setQuery(async () => { throw new Error('db down'); });
    expect((await send({ ...okBody, agent: 'advisor' })).statusCode).toBe(200);
    setQuery(null);
    expect((await send({ ...okBody, agent: 'advisor' })).statusCode).toBe(200);
  });
});
