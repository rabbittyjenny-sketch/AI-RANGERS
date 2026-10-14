import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { aiService } from './aiService';
import { GUARD_BADGE_MARKER } from './orchestratorEngine';
import { RANGER_SKILLS } from '../data/rangerSkills';
import { STANDARD_RULES } from '../data/standardRules';
import { getAllAgents, getAgentById } from '../data/agents';

/**
 * เส้นทางจริงของระบบ: ผู้ใช้เลือกน้องเอง (id ใน Workspace) → aiService ส่งตรงไปหาน้องนั้น →
 * Claude ตอบ → Orchestrator ตรวจ 6 guards → ถึงผู้ใช้
 * ไม่มีการกระจายงานอัตโนมัติ — เทสต์นี้ยืนยันว่าน้องที่เลือกคือน้องที่ตอบ และคำตอบผ่าน guard ก่อนส่งเสมอ
 */

// id ที่ Workspace.jsx ส่งมา (RANGERS ที่ไม่ใช่ comingSoon) → agent จริง
const UI_RANGERS: Array<{ uiId: string; agentId: string; name: string }> = [
  { uiId: 'brand', agentId: 'brand-builder', name: 'น้องแบรนด์' },
  { uiId: 'content', agentId: 'content-creator', name: 'น้องคอนเทนต์' },
  { uiId: 'planning', agentId: 'campaign-planner', name: 'น้องแพลน' },
  { uiId: 'bizplan', agentId: 'business-planner', name: 'น้องแผนธุรกิจ' },
  { uiId: 'marketing', agentId: 'market-insight', name: 'น้องดูตลาด' },
  { uiId: 'consult', agentId: 'advisor', name: 'น้องที่ปรึกษา' },
];

function jsonResponse(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
}

const passChecks = () => ({
  checks: Object.fromEntries(
    ['factCheck', 'uspGrounding', 'referenceValidation', 'consistency'].map(k => [k, { verdict: 'pass', reason: 'ผ่าน' }])),
});

function installFetch(chatText: string | string[] = 'คำตอบจากน้อง') {
  const texts = Array.isArray(chatText) ? [...chatText] : [chatText];
  const fn = vi.fn(async (url: string, _init?: any) => {
    if (url === '/api/guard') return jsonResponse(200, passChecks());
    if (url === '/api/anthropic') {
      const text = texts.length > 1 ? texts.shift()! : texts[0];
      return jsonResponse(200, { text, stopReason: 'end_turn' });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const calls = (f: ReturnType<typeof installFetch>, url: string) =>
  f.mock.calls.filter(c => c[0] === url).map(c => JSON.parse((c[1] as any).body));

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

describe('the Ranger the user picks is the one that answers', () => {
  it('covers every real agent exactly once (6 Rangers)', () => {
    expect(UI_RANGERS.map(r => r.agentId).sort()).toEqual(getAllAgents().map(a => a.id).sort());
  });

  it.each(UI_RANGERS)('$uiId → $name: its own prompt and brand context only', async ({ uiId, agentId, name }) => {
    const f = installFetch();
    await aiService.sendMessage(uiId, 'ช่วยหน่อย', [], brandCtx as any);

    const [{ system }] = calls(f, '/api/anthropic');
    expect(system).toContain(getAgentById(agentId)!.systemPrompt);
    expect(system).toContain(`## คำสั่งสำหรับ ${name}`);
    expect(system).toContain(STANDARD_RULES); // ข้อห้ามมาตรฐานเหมือนกันทุกตัว
    expect(system).toContain('ร้านกาแฟดี');
    for (const other of UI_RANGERS.filter(r => r.agentId !== agentId)) {
      expect(system, `${name} got ${other.name}'s instructions`).not.toContain(`## คำสั่งสำหรับ ${other.name}`);
    }
  });

  it('keeps the system prompt identical across questions, so it stays cacheable, and puts a matching skill in the user turn only', async () => {
    const f = installFetch();
    await aiService.sendMessage('content', 'ช่วยเขียนแคปชันกาแฟหน่อย', [], brandCtx as any);
    await aiService.sendMessage('content', 'อยากทำไลฟ์ขายกาแฟ ต้องเตรียมอะไร', [], brandCtx as any);
    const [plain, live] = calls(f, '/api/anthropic');
    expect(live.system).toBe(plain.system);
    const skillTitle = RANGER_SKILLS.find(s => s.id === 'tiktok-live')!.title;
    expect(live.system).not.toContain(skillTitle);
    // ไม่ตรง skill = ข้อความผู้ใช้เดิมเป๊ะ; ตรง = ต่อท้ายด้วยความรู้ และยังเป็นข้อความเดียว (เครดิตไม่ถูกนับเป็นไฟล์แนบ)
    expect(plain.messages).toEqual([{ role: 'user', content: 'ช่วยเขียนแคปชันกาแฟหน่อย' }]);
    expect(typeof live.messages[0].content).toBe('string');
    expect(live.messages[0].content.startsWith('อยากทำไลฟ์ขายกาแฟ ต้องเตรียมอะไร\n\n---\n')).toBe(true);
    expect(live.messages[0].content).toContain(skillTitle);
  });

  it('does not hand one Ranger the skills of another', async () => {
    const f = installFetch();
    await aiService.sendMessage('brand', 'ทำไลฟ์ tiktok live ยังไง', [], brandCtx as any);
    expect(calls(f, '/api/anthropic')[0].messages).toEqual([{ role: 'user', content: 'ทำไลฟ์ tiktok live ยังไง' }]);
  });

  it('accepts the long agent ids too', async () => {
    const f = installFetch();
    await aiService.sendMessage('market-insight', 'วิเคราะห์ตลาด', [], brandCtx as any);
    expect(calls(f, '/api/anthropic')[0].system).toContain('## คำสั่งสำหรับ น้องดูตลาด');
  });

  it('falls back to the advisor for an unknown id (e.g. the coming-soon Ranger)', async () => {
    const f = installFetch();
    await aiService.sendMessage('what', 'ทดสอบ', [], brandCtx as any);
    expect(calls(f, '/api/anthropic')[0].system).toContain('## คำสั่งสำหรับ น้องที่ปรึกษา');
  });

  it('processMessage: forceAgent picks the Ranger, and no forceAgent means the advisor', async () => {
    const f = installFetch();
    const forced = await aiService.processMessage({ userInput: 'วางแผน', context: brandCtx as any, forceAgent: 'planning' } as any);
    expect(forced.agentId).toBe('campaign-planner');
    const none = await aiService.processMessage({ userInput: 'สวัสดี', context: brandCtx as any } as any);
    expect(none.agentId).toBe('advisor');
    expect(calls(f, '/api/anthropic').map(b => b.system.includes('## คำสั่งสำหรับ น้องแพลน'))).toEqual([true, false]);
  });

  it('processMessage keeps each Ranger\'s history separate', async () => {
    const f = installFetch();
    await aiService.processMessage({ userInput: 'เรื่องแบรนด์ A', context: brandCtx as any, forceAgent: 'brand' } as any);
    await aiService.processMessage({ userInput: 'เรื่องโพสต์ B', context: brandCtx as any, forceAgent: 'content' } as any);
    const [, second] = calls(f, '/api/anthropic');
    expect(JSON.stringify(second.messages)).toContain('เรื่องโพสต์ B');
    expect(JSON.stringify(second.messages)).not.toContain('เรื่องแบรนด์ A');
  });
});

describe('every answer passes the guards before it reaches the user', () => {
  it.each(UI_RANGERS)('$name: Claude first, then the guard on that exact answer, then the user', async ({ uiId, agentId }) => {
    const f = installFetch('ตอบเรื่องกาแฟออร์แกนิกพรีเมียมสำหรับคนทำงาน');
    const r = await aiService.sendMessage(uiId, 'ช่วยหน่อย', [], brandCtx as any);

    // ไม่มีการบันทึกแชทที่ไหนเลย: มีแค่เรียก Claude แล้วตรวจ guard
    expect(f.mock.calls.map(c => c[0])).toEqual(['/api/anthropic', '/api/guard']);
    expect(calls(f, '/api/anthropic')[0].agent).toBe(agentId);
    expect(calls(f, '/api/guard')[0].content).toBe('ตอบเรื่องกาแฟออร์แกนิกพรีเมียมสำหรับคนทำงาน');
    expect(r.ok).toBe(true);
    expect(r.text.startsWith('ตอบเรื่องกาแฟออร์แกนิกพรีเมียมสำหรับคนทำงาน' + GUARD_BADGE_MARKER)).toBe(true);
  });

  it.each(UI_RANGERS)('$name: an answer with a forbidden word is never delivered', async ({ uiId }) => {
    const bad = 'กาแฟของเราถูกที่สุดในย่านนี้';
    const f = installFetch(bad);
    const r = await aiService.sendMessage(uiId, 'ช่วยหน่อย', [], brandCtx as any);

    expect(calls(f, '/api/anthropic')).toHaveLength(3); // ตอบ + แก้ 2 รอบ
    expect(r.text).not.toContain(bad);
    expect(r.text).not.toContain(GUARD_BADGE_MARKER);
    expect(r.text).toContain('ถูกที่สุด'); // บอกเหตุผลที่ไม่ผ่าน
    expect(r.text.startsWith('⚠️')).toBe(true);
  });

  it('a blocked first answer is replaced by the corrected one, and only that one is shown', async () => {
    installFetch(['ราคาถูกที่สุดในโลก', 'ราคาเป็นมิตรสำหรับคนทำงาน']);
    const r = await aiService.sendMessage('content', 'ช่วยหน่อย', [], brandCtx as any);
    expect(r.text.startsWith('ราคาเป็นมิตรสำหรับคนทำงาน' + GUARD_BADGE_MARKER)).toBe(true);
    expect(r.text).not.toContain('ถูกที่สุดในโลก');
  });
});
