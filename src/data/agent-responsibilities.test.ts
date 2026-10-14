import { describe, it, expect } from 'vitest';
import { agentResponsibilities } from './agent-responsibilities';
import { getAllAgents } from './agents';

const RANGER_IDS = ['brand-builder', 'content-creator', 'campaign-planner', 'business-planner', 'market-insight', 'advisor'];

describe('agentResponsibilities (6 independent Rangers)', () => {
  it('covers exactly the 6 Rangers defined in agents.ts', () => {
    expect(Object.keys(agentResponsibilities).sort()).toEqual([...RANGER_IDS].sort());
    expect(getAllAgents().map(a => a.id).sort()).toEqual([...RANGER_IDS].sort());
  });

  it('gives every Ranger its own non-empty list of owned work', () => {
    for (const id of RANGER_IDS) {
      const r = agentResponsibilities[id as keyof typeof agentResponsibilities];
      expect(r.owns.length, id).toBeGreaterThan(0);
    }
  });

  it('does not let two Rangers own the same thing', () => {
    const seen = new Map<string, string>();
    for (const id of RANGER_IDS) {
      for (const item of agentResponsibilities[id as keyof typeof agentResponsibilities].owns) {
        expect(seen.get(item), `"${item}" owned by both ${seen.get(item)} and ${id}`).toBeUndefined();
        seen.set(item, id);
      }
    }
  });

  it('only hands off to Rangers that exist, never to itself', () => {
    for (const id of RANGER_IDS) {
      const { canHandoff } = agentResponsibilities[id as keyof typeof agentResponsibilities];
      for (const target of canHandoff) {
        expect(RANGER_IDS, `${id} -> ${target}`).toContain(target);
        expect(target, `${id} hands off to itself`).not.toBe(id);
      }
    }
  });

  it('has no required order: every Ranger is phase 1 and none depends on another', () => {
    for (const id of RANGER_IDS) {
      const r = agentResponsibilities[id as keyof typeof agentResponsibilities] as Record<string, unknown>;
      expect(r.phase, id).toBe(1);
      expect(r.dependsOn, id).toBeUndefined();
      expect(r.requires, id).toBeUndefined();
    }
  });

  it('lets the advisor hand off to every other Ranger', () => {
    expect([...agentResponsibilities.advisor.canHandoff].sort())
      .toEqual(RANGER_IDS.filter(id => id !== 'advisor').sort());
  });

  it('matches each agent cluster and name in agents.ts', () => {
    for (const agent of getAllAgents()) {
      expect(agent.name, agent.id).toMatch(/^น้อง/);
      expect(['brand', 'content', 'planning', 'marketing', 'advisor']).toContain(agent.cluster);
    }
  });
});
