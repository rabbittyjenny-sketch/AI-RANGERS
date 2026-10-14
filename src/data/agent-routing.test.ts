import { describe, it, expect } from 'vitest';
import { routeToAgent, getSoftAdvisory } from './agent-routing';
import { getAllAgents, findBestAgentForInput } from './agents';

/**
 * routeToAgent เป็นตัวช่วยแนะนำน้อง (keyword scoring) — ปัจจุบันผู้ใช้เลือกน้องเองใน Workspace
 * และ aiService ส่งข้อความตรงไปหาน้องที่เลือก ไม่ผ่าน routeToAgent
 * เทสต์นี้กันไม่ให้ตัวช่วยนี้เพี้ยนถ้าจะนำกลับมาใช้ (เช่น แนะนำน้องที่เหมาะสม)
 */
describe('routeToAgent (6 Rangers)', () => {
  const cases: Array<[string, string]> = [
    ['ช่วยตั้งชื่อแบรนด์ให้หน่อย', 'brand-builder'],
    ['โลโก้และสีแบรนด์', 'brand-builder'],
    ['เขียนแคปชั่น instagram ให้หน่อย', 'content-creator'],
    ['โพสต์ facebook', 'content-creator'],
    ['วางแผนแคมเปญวันที่ 11.11', 'campaign-planner'],
    ['อยากทำแผนธุรกิจ SWOT', 'business-planner'],
    ['แผนการเงินและจุดคุ้มทุน', 'business-planner'],
    ['ทำปฏิทินโพสต์เดือนหน้า', 'campaign-planner'],
    ['วิเคราะห์คู่แข่งและตลาด', 'market-insight'],
  ];

  it.each(cases)('routes %j to %s', (input, expected) => {
    const d = routeToAgent(input);
    expect(d.primaryAgent.id).toBe(expected);
    expect(d.isAdvisorFallback).toBe(false);
    expect(d.confidence).toBeGreaterThan(0.3);
    expect(d.confidence).toBeLessThanOrEqual(1);
  });

  it('sends general or unclear questions to the advisor', () => {
    expect(routeToAgent('สวัสดี').primaryAgent.id).toBe('advisor');
    expect(routeToAgent('ทำยังไงดี').primaryAgent.id).toBe('advisor');
  });

  it('falls back to the advisor with 0.5 confidence when nothing matches', () => {
    const d = routeToAgent('xyz');
    expect(d.primaryAgent.id).toBe('advisor');
    expect(d.isAdvisorFallback).toBe(true);
    expect(d.confidence).toBe(0.5);
  });

  it('always returns one of the 5 real agents, whatever the input', () => {
    const ids = new Set(getAllAgents().map(a => a.id));
    for (const input of ['', '   ', '!!!', 'a'.repeat(5000), 'ตลาดและคู่แข่งและโพสต์', '🙂']) {
      expect(ids.has(routeToAgent(input).primaryAgent.id), JSON.stringify(input.slice(0, 20))).toBe(true);
    }
  });

  it('agrees with findBestAgentForInput on clear requests', () => {
    for (const [input, expected] of cases) {
      expect(findBestAgentForInput(input).id).toBe(expected);
    }
  });
});

describe('getSoftAdvisory', () => {
  it('only suggests Rangers that exist, and never suggests itself', () => {
    const agents = getAllAgents();
    for (const agent of agents) {
      const tip = getSoftAdvisory(agent.id);
      if (!tip) continue;
      const mentioned = agents.filter(a => tip.includes(a.name));
      expect(mentioned.length, `${agent.id}: ${tip}`).toBeGreaterThan(0);
      expect(tip.includes(agent.name), `${agent.id} suggests itself`).toBe(false);
    }
  });

  it('returns null for an unknown agent', () => {
    expect(getSoftAdvisory('market-analyzer')).toBeNull();
  });
});
