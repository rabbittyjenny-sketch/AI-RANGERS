import { describe, it, expect } from 'vitest';
import { RANGER_KNOWLEDGE, withKnowledge } from './rangerKnowledge';
import { getAgentById } from './agents';

const RANGERS = ['brand-builder', 'content-creator', 'campaign-planner', 'market-insight', 'advisor'];

describe('ranger knowledge packs', () => {
  it('has a pack for every Ranger, appended after its own prompt', () => {
    for (const id of RANGERS) {
      const agent = getAgentById(id);
      expect(agent, id).toBeTruthy();
      const system = withKnowledge(id, agent!.systemPrompt);
      expect(system.startsWith(agent!.systemPrompt)).toBe(true);
      expect(system).toContain(RANGER_KNOWLEDGE[id]);
      expect(system).toContain('ห้ามแต่งตัวเลข');
    }
  });

  it('leaves room for brand context under the server limit (30,000 chars)', () => {
    for (const id of RANGERS) {
      expect(withKnowledge(id, getAgentById(id)!.systemPrompt).length, id).toBeLessThan(15000);
    }
  });

  it('names a source for every section that quotes a percentage', () => {
    for (const [id, pack] of Object.entries(RANGER_KNOWLEDGE)) {
      for (const section of pack.split('\n### ').slice(1)) {
        const [heading, ...body] = section.split('\n');
        for (const line of body.filter(l => /\d+(\.\d+)?%/.test(l))) {
          // แหล่งอยู่ที่หัวข้อหรือในบรรทัดนั้นเอง
          expect(`${heading} ${line}`, `${id}: ${line}`).toMatch(/\([^)]*(20\d\d|TH|SEA)[^)]*\)/);
        }
      }
    }
  });

  it('returns the prompt unchanged for an unknown agent', () => {
    expect(withKnowledge('nope', 'x')).toBe('x');
  });
});
