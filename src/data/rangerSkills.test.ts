import { describe, it, expect } from 'vitest';
import { RANGER_SKILLS, selectSkills, withSkills, MAX_SKILLS_PER_MESSAGE } from './rangerSkills';
import { getAllAgents } from './agents';

const AGENT_IDS = getAllAgents().map(a => a.id);

describe('skills table', () => {
  it('has unique ids and every skill belongs to a real Ranger', () => {
    expect(new Set(RANGER_SKILLS.map(s => s.id)).size).toBe(RANGER_SKILLS.length);
    for (const s of RANGER_SKILLS) expect(AGENT_IDS, s.id).toContain(s.agent);
  });

  it('keeps every skill short and specific (token budget)', () => {
    for (const s of RANGER_SKILLS) {
      expect(s.body.length, `${s.id} body`).toBeLessThanOrEqual(1100);
      expect(s.triggers.length, `${s.id} triggers`).toBeGreaterThanOrEqual(2);
      for (const t of s.triggers) expect(t.trim().length, `${s.id}: "${t}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('never leaves a percentage without a source and year in the same skill', () => {
    for (const s of RANGER_SKILLS) {
      if (!/\d+(\.\d+)?%/.test(s.body)) continue;
      expect(s.body, `${s.id} quotes a % without (source, year)`).toMatch(/(20\d\d|Statista|McKinsey|Buffer|Dreamgrow|TikTok|Firework|Trade Desk|ECDB)/);
    }
  });
});

describe('selectSkills', () => {
  it('picks the skill whose trigger words are in the user message', () => {
    expect(selectSkills('content-creator', 'อยากทำไลฟ์ขายกาแฟ ต้องเตรียมอะไร').map(s => s.id)).toEqual(['tiktok-live']);
    expect(selectSkills('market-insight', 'ตลาดกาแฟออนไลน์ในไทยเป็นยังไง').map(s => s.id)).toEqual(['th-digital-economy']);
    expect(selectSkills('campaign-planner', 'วางแผนแคมเปญ 11.11 ให้หน่อย').map(s => s.id)).toEqual(['mega-sale']);
    expect(selectSkills('advisor', 'อยากทำ RFM จากลูกค้าเก่า').map(s => s.id)).toEqual(['customer-data-rfm']);
  });

  it('adds nothing (zero extra tokens) when the question matches no skill', () => {
    for (const q of ['สวัสดีค่ะ', 'ช่วยเขียนแคปชันกาแฟหน่อย', 'ทำยังไงดี', '']) {
      expect(selectSkills('content-creator', q), q).toEqual([]);
    }
  });

  it('only uses the skills of the Ranger being asked', () => {
    expect(selectSkills('brand-builder', 'ทำไลฟ์ tiktok live')).toEqual([]);
    expect(selectSkills('business-planner', 'ทำไลฟ์ tiktok live')).toEqual([]);
  });

  it('caps the number of skills per message, best match first', () => {
    const q = 'tiktok คลิปสั้น ไลฟ์ lemon8 seo cta layout ได้รับสนับสนุน';
    const picked = selectSkills('content-creator', q);
    expect(picked.length).toBeLessThanOrEqual(MAX_SKILLS_PER_MESSAGE);
    expect(picked.length).toBe(MAX_SKILLS_PER_MESSAGE);
  });

  it('matches English trigger words only as whole words, Thai as substrings', () => {
    expect(selectSkills('brand-builder', 'we suspect something')).toEqual([]); // "usp" inside "suspect"
    expect(selectSkills('brand-builder', 'USP ของร้านเราคืออะไร').map(s => s.id)).toEqual(['value-proposition']);
    expect(selectSkills('content-creator', 'delivery ของร้าน')).toEqual([]);  // "live" inside "delivery"
    expect(selectSkills('content-creator', 'TikTok LIVE วันนี้').map(s => s.id)).toContain('tiktok-live');
  });
});

describe('withSkills', () => {
  it('returns the user text untouched when nothing matches', () => {
    expect(withSkills('content-creator', 'สวัสดีค่ะ')).toBe('สวัสดีค่ะ');
  });

  it('keeps the question first, then the rules, then only the matching skill', () => {
    const out = withSkills('content-creator', 'อยากทำไลฟ์ขายกาแฟ');
    expect(out.startsWith('อยากทำไลฟ์ขายกาแฟ\n\n---\n')).toBe(true);
    expect(out).toContain('ห้ามเดาหรือเพิ่มตัวเลข');
    expect(out).toContain('ไลฟ์ขายของ TikTok Shop');
    expect(out).not.toContain('Lemon8');
    expect(out.length).toBeLessThan(1700 + 'อยากทำไลฟ์ขายกาแฟ'.length);
  });
});
