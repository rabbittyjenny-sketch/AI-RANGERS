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
  'CHAT_RATE_LIMIT', 'GUARD_AI_ENABLED', 'GUARD_MODEL', 'ALLOWED_ORIGINS'];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  resetRateLimits();
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
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.max_tokens).toBe(4096);
    expect(sent.output_config).toEqual({ effort: 'low' });
    expect(sent.tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }]);
    expect(sent.temperature).toBeUndefined();
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
    process.env.WEB_SEARCH_MAX_USES = '0';
    process.env.CHAT_MAX_TOKENS = '2000';
    const req = buildChatRequest('SYS', [{ role: 'user', content: 'q' }]);
    expect(req.model).toBe('claude-sonnet-5-5');
    expect(req.output_config).toBeUndefined();
    expect(req.tools).toBeUndefined();
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
