import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./databaseService', () => ({
  databaseService: { saveMessage: vi.fn().mockResolvedValue(undefined) },
}));

import { dataGuardian, isolationGuard, antiCopycatGuard, textSimilarity } from './dataGuardService';
import { orchestratorEngine, GUARD_BADGE_MARKER, stripGuardBadge } from './orchestratorEngine';
import { aiService, formatSources } from './aiService';

type Verdict = 'pass' | 'warn' | 'fail';
function aiVerdicts(over: Partial<Record<string, [Verdict, string]>> = {}) {
  const base: Record<string, [Verdict, string]> = {
    factCheck: ['pass', 'ผ่าน'],
    uspGrounding: ['pass', 'ผ่าน'],
    referenceValidation: ['pass', 'ผ่าน'],
    consistency: ['pass', 'ผ่าน'],
    ...over,
  };
  return Object.fromEntries(Object.entries(base).map(([k, [verdict, reason]]) => [k, { verdict, reason }]));
}

function jsonResponse(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
}

/** fetch ปลอม: /api/guard คืนผลตาม queue, /api/anthropic คืนข้อความตาม queue */
function installFetch(opts: { guard?: any[]; chat?: any[] } = {}) {
  const guardQueue = [...(opts.guard || [])];
  const chatQueue = [...(opts.chat || [])];
  const fn = vi.fn(async (url: string, init: any) => {
    if (url === '/api/guard') {
      const next = guardQueue.length > 1 ? guardQueue.shift() : guardQueue[0];
      return next ?? jsonResponse(200, { checks: aiVerdicts() });
    }
    if (url === '/api/anthropic') {
      const next = chatQueue.length > 1 ? chatQueue.shift() : chatQueue[0];
      return next ?? jsonResponse(200, { text: 'คำตอบ', stopReason: 'end_turn' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const brandCtx = {
  brandId: '7',
  brandNameTh: 'ร้านกาแฟดี',
  coreUSP: 'กาแฟออร์แกนิกพรีเมียม',
  toneOfVoice: 'friendly',
  targetAudience: 'คนทำงาน',
  forbiddenWords: ['ถูกที่สุด'],
};

beforeEach(() => {
  aiService.clearHistory();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dataGuardian — 6 checks', () => {
  it('passes clean content when the AI guard passes', async () => {
    installFetch();
    const r = await dataGuardian.validateContent(brandCtx, 'แนะนำเมนูใหม่ของร้าน');
    expect(r.overallStatus).toBe('passed');
    expect(r.aiChecked).toBe(true);
    expect(Object.keys(r.checks).sort()).toEqual(
      ['antiCopycat', 'consistency', 'factCheck', 'isolation', 'referenceValidation', 'uspGrounding']
    );
  });

  it('blocks on AI factCheck/uspGrounding fail but only warns on referenceValidation/consistency fail', async () => {
    installFetch({ guard: [jsonResponse(200, { checks: aiVerdicts({ factCheck: ['fail', 'อ้างสถิติตลาด 45% โดยไม่มีที่มา'] }) })] });
    const blocked = await dataGuardian.validateContent(brandCtx, 'ตลาดโต 45%');
    expect(blocked.overallStatus).toBe('blocked');
    expect(blocked.blockReasons).toEqual(['อ้างสถิติตลาด 45% โดยไม่มีที่มา']);

    installFetch({ guard: [jsonResponse(200, { checks: aiVerdicts({ referenceValidation: ['fail', 'ไม่มีที่มา'], consistency: ['fail', 'โทนแข็ง'] }) })] });
    const warned = await dataGuardian.validateContent(brandCtx, 'ข้อความ');
    expect(warned.overallStatus).toBe('warning');
    expect(warned.blockReasons).toEqual([]);
  });

  it('blocks brand forbidden words even when the AI passes', async () => {
    installFetch();
    const r = await dataGuardian.validateContent(brandCtx, 'กาแฟเราถูกที่สุดในย่านนี้');
    expect(r.overallStatus).toBe('blocked');
    expect(r.checks.consistency.message).toContain('ถูกที่สุด');
  });

  it('does not block, and reports aiChecked=false, when the AI guard is unavailable', async () => {
    installFetch({ guard: [jsonResponse(502, { error: { code: 'auth' } })] });
    const r = await dataGuardian.validateContent(brandCtx, 'ข้อความปกติ');
    expect(r.overallStatus).toBe('passed');
    expect(r.aiChecked).toBe(false);
    expect(r.aiError).toBe('auth');

    installFetch({ guard: [jsonResponse(200, { skipped: true })] });
    const off = await dataGuardian.validateContent(brandCtx, 'ข้อความปกติ');
    expect(off.aiChecked).toBe(false);
  });

  it('isolation: guests always pass, theft content blocks, competitor analysis does not', () => {
    const steal = 'วิธีขโมยข้อมูลรายชื่อลูกค้าของคู่แข่ง';
    expect(isolationGuard.check({ brandId: 'guest' }, steal).passed).toBe(true);
    expect(isolationGuard.check({ brandId: '7' }, steal).passed).toBe(false);
    expect(isolationGuard.check({ brandId: '7' }, 'How to scrape competitor customer list data').passed).toBe(false);
    expect(isolationGuard.check({ brandId: '7' }, 'วิเคราะห์จุดแข็งของแบรนด์คู่แข่งจากข้อมูลสาธารณะ').passed).toBe(true);
  });

  it('antiCopycat gives the same result on repeated calls (no /g regex state)', () => {
    const text = 'Just do it แบบสไตล์เรา';
    const a = antiCopycatGuard.check({}, text);
    const b = antiCopycatGuard.check({}, text);
    expect(a.passed).toBe(false);
    expect(b.passed).toBe(false);
    expect(antiCopycatGuard.check({}, 'ภาพสไตล์ปิกัสโซ').severity).toBe('warning');
  });

  it('antiCopycat compares against the original the user sent', () => {
    const original = 'ร้านกาแฟของเราคัดสรรเมล็ดกาแฟออร์แกนิกจากดอยช้าง คั่วสดทุกสัปดาห์ '.repeat(5);
    expect(textSimilarity(original, original)).toBe(1);
    expect(antiCopycatGuard.check({}, original + 'ค่ะ', { originalContent: original }).severity).toBe('warning');
    expect(antiCopycatGuard.check({}, 'โพสต์ใหม่ทั้งหมดเกี่ยวกับโปรโมชั่นวันแม่', { originalContent: original }).passed).toBe(true);
  });
});

describe('orchestratorEngine.processAndDeliver', () => {
  const base = {
    agentId: 'content-creator',
    agentName: 'Content',
    userInput: 'เขียนโพสต์',
    context: brandCtx as any,
    brandKey: '',
    messages: [{ role: 'user' as const, content: 'เขียนโพสต์' }],
  };

  it('sends block reasons back to Claude and badges the fixed answer', async () => {
    installFetch({
      guard: [
        jsonResponse(200, { checks: aiVerdicts({ uspGrounding: ['fail', 'ขัดกับ USP พรีเมียม'] }) }),
        jsonResponse(200, { checks: aiVerdicts() }),
      ],
    });
    const callClaudeFn = vi.fn().mockResolvedValue('โพสต์ที่แก้แล้ว');
    const r = await orchestratorEngine.processAndDeliver({ ...base, rawResponse: 'ลดราคาสุดคุ้ม', callClaudeFn });

    expect(callClaudeFn).toHaveBeenCalledTimes(1);
    const retryMessages = callClaudeFn.mock.calls[0][0];
    expect(retryMessages.at(-1).content).toContain('ขัดกับ USP พรีเมียม');
    expect(r.text).toBe(`โพสต์ที่แก้แล้ว${GUARD_BADGE_MARKER}✅ ผ่านการตรวจ 6 ด้าน`);
    expect(r.guardReport?.aiChecked).toBe(true);
  });

  it('gives up after 3 blocked attempts without a pass badge', async () => {
    installFetch({ guard: [jsonResponse(200, { checks: aiVerdicts({ factCheck: ['fail', 'แต่งสถิติ'] }) })] });
    const callClaudeFn = vi.fn().mockResolvedValue('ยังแต่งสถิติ');
    const r = await orchestratorEngine.processAndDeliver({ ...base, rawResponse: 'สถิติปลอม', callClaudeFn });
    expect(callClaudeFn).toHaveBeenCalledTimes(2);
    expect(r.text).toContain('พยายาม 3 ครั้ง');
    expect(r.text).not.toContain('✅');
  });

  it('lists warnings in the badge', async () => {
    installFetch({ guard: [jsonResponse(200, { checks: aiVerdicts({ referenceValidation: ['warn', 'ควรระบุแหล่งที่มา'] }) })] });
    const r = await orchestratorEngine.processAndDeliver({ ...base, rawResponse: 'ตอบ', callClaudeFn: vi.fn() });
    expect(r.text).toContain('⚠️ ข้อควรระวัง: ควรระบุแหล่งที่มา');
  });

  it('says the AI guard was unavailable instead of claiming a full pass', async () => {
    installFetch({ guard: [jsonResponse(503, { error: { code: 'overloaded' } })] });
    const r = await orchestratorEngine.processAndDeliver({ ...base, rawResponse: 'ตอบ', callClaudeFn: vi.fn() });
    expect(r.text).toContain('ตัวตรวจ AI ไม่พร้อม');
    expect(r.text).not.toContain('ผ่านการตรวจ 6 ด้าน');
  });
});

describe('aiService.sendMessage', () => {
  it('shows a real error with no badge, and skips the guard, when Claude fails', async () => {
    const f = installFetch({ chat: [jsonResponse(502, { error: { code: 'billing', message: 'เครดิตไม่พอ' } })] });
    const r = await aiService.sendMessage('content', 'เขียนโพสต์', [], brandCtx as any);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('เครดิต API หมด');
    expect(r.text).not.toContain(GUARD_BADGE_MARKER);
    expect(f.mock.calls.map(c => c[0])).toEqual(['/api/anthropic']);
  });

  it('puts brand context only in system, and never sends a model or key from the browser', async () => {
    const f = installFetch({ chat: [jsonResponse(200, { text: 'โพสต์ใหม่', stopReason: 'end_turn' })] });
    const r = await aiService.sendMessage('content', 'เขียนโพสต์', [], brandCtx as any);
    expect(r.ok).toBe(true);
    expect(r.text.startsWith('โพสต์ใหม่' + GUARD_BADGE_MARKER)).toBe(true);
    expect(r.confidence).toBeUndefined();

    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/anthropic');
    expect(init.headers['x-api-key']).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(['messages', 'system']);
    expect(init.headers['X-Ranger-User']).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.system).toContain('ร้านกาแฟดี');
    expect(body.messages).toEqual([{ role: 'user', content: 'เขียนโพสต์' }]);
  });

  it('passes credits through, and sends the turnId on guard retries so they are not charged', async () => {
    const credits = { cost: 1, used: 1, remaining: 29, limit: 30, resetsAt: '2026-10-14T17:00:00.000Z' };
    const f = installFetch({
      chat: [
        jsonResponse(200, { text: 'ตลาดโต 45%', stopReason: 'end_turn', credits, turnId: 'turn-1' }),
        jsonResponse(200, { text: 'แก้แล้ว', stopReason: 'end_turn', credits: null }),
      ],
      guard: [
        jsonResponse(200, { checks: aiVerdicts({ factCheck: ['fail', 'แต่งสถิติ'] }) }),
        jsonResponse(200, { checks: aiVerdicts() }),
      ],
    });
    const r = await aiService.sendMessage('content', 'เขียนโพสต์', [], brandCtx as any);
    expect(r.credits).toEqual(credits);
    expect(r.text.startsWith('แก้แล้ว')).toBe(true);
    const chatBodies = f.mock.calls.filter(c => c[0] === '/api/anthropic').map(c => JSON.parse(c[1].body));
    expect(chatBodies[0].turnId).toBeUndefined();
    expect(chatBodies[1].turnId).toBe('turn-1');
  });

  it('appends the real sources in one short line, and the guard checks the answer together with them', async () => {
    const f = installFetch({
      chat: [jsonResponse(200, {
        text: 'ตลาดกาแฟโตต่อเนื่อง', stopReason: 'end_turn',
        sources: [{ title: 'Coffee Market Report', url: 'https://www.example.com/report' }, { title: '', url: 'https://news.test/a' }],
      })],
    });
    const r = await aiService.sendMessage('marketing', 'ตลาดกาแฟเป็นยังไง', [], brandCtx as any);
    const answer = 'ตลาดกาแฟโตต่อเนื่อง\n\n📚 ที่มา: Coffee Market Report (example.com) · news.test';
    expect(r.text.startsWith(answer + GUARD_BADGE_MARKER)).toBe(true);
    const guardBody = JSON.parse(f.mock.calls.find(c => c[0] === '/api/guard')![1].body);
    expect(guardBody.content).toBe(answer);
  });

  it('formatSources: nothing without sources, skips bad urls, at most 3, no links', () => {
    expect(formatSources(undefined)).toBe('');
    expect(formatSources([])).toBe('');
    expect(formatSources([{ title: 'x', url: 'not a url' }])).toBe('');
    const four = ['a', 'b', 'c', 'd'].map(h => ({ title: h.toUpperCase(), url: `https://${h}.com/p` }));
    const out = formatSources(four);
    expect(out).toBe('\n\n📚 ที่มา: A (a.com) · B (b.com) · C (c.com)');
    expect(out).not.toContain('http');
  });

  it('explains a used-up daily quota', async () => {
    installFetch({ chat: [jsonResponse(429, { error: { code: 'quota_exceeded' }, credits: { cost: 0, used: 30, remaining: 0, limit: 30, resetsAt: 'x' } })] });
    const r = await aiService.sendMessage('content', 'เขียนโพสต์', [], brandCtx as any);
    expect(r.ok).toBe(false);
    expect(r.text).toContain('เครดิตวันนี้ใช้ครบแล้ว');
    expect(r.credits?.remaining).toBe(0);
  });

  it('strips guard badges and error notices from history before resending', async () => {
    const f = installFetch();
    const history = [
      { role: 'assistant' as const, content: 'สวัสดีค่ะ' },
      { role: 'user' as const, content: 'ข้อ 1' },
      { role: 'assistant' as const, content: `ตอบ 1${GUARD_BADGE_MARKER}✅ ผ่านการตรวจ 6 ด้าน` },
      { role: 'user' as const, content: 'ข้อ 2' },
      { role: 'assistant' as const, content: '⚠️ ยังตอบไม่ได้ในขณะนี้\n\nลองใหม่' },
    ];
    await aiService.sendMessage('content', 'ข้อ 3', history, brandCtx as any);
    const body = JSON.parse(f.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'user', content: 'ข้อ 1' },
      { role: 'assistant', content: 'ตอบ 1' },
      { role: 'user', content: 'ข้อ 3' },
    ]);
    expect(stripGuardBadge('x')).toBe('x');
  });
});
