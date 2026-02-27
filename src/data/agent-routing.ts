/**
 * Agent Routing — Phase 1 (5 Agents)
 * ใช้ keyword scoring + context fallback
 * ไม่มี hard dependency block — ทุกอย่างเป็น advisory
 */

import { getAllAgents, findBestAgentForInput, type Agent } from './agents';

export interface RoutingDecision {
  primaryAgent: Agent;
  confidence: number;       // 0-1
  reasoning: string;
  isAdvisorFallback: boolean;
}

/**
 * Route user input ไปหา Agent ที่เหมาะสม
 * ไม่มี hard block — ถ้าไม่แน่ใจ fallback ไป advisor เสมอ
 */
export function routeToAgent(userInput: string): RoutingDecision {
  const agents = getAllAgents();
  const lower = userInput.toLowerCase();

  // Score each agent
  const scored = agents.map(agent => {
    const score = agent.keywords.reduce(
      (acc, kw) => acc + (lower.includes(kw.toLowerCase()) ? 1 : 0),
      0
    );
    return { agent, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const total = scored.reduce((acc, s) => acc + s.score, 0);

  // ถ้า best score = 0 หรือสูสีมาก (< 30% ของ total) → fallback advisor
  const isAdvisorFallback = best.score === 0 || (total > 0 && best.score / total < 0.3);

  if (isAdvisorFallback) {
    const advisor = agents.find(a => a.id === 'advisor')!;
    return {
      primaryAgent: advisor,
      confidence: 0.5,
      reasoning: 'ไม่แน่ใจว่าต้องการอะไร → ส่งไป advisor ก่อน',
      isAdvisorFallback: true,
    };
  }

  const confidence = total > 0 ? Math.min(best.score / total, 1) : 0.5;

  return {
    primaryAgent: best.agent,
    confidence,
    reasoning: `keyword match: ${best.score}/${total} → ${best.agent.name}`,
    isAdvisorFallback: false,
  };
}

/**
 * Soft advisory — บอกผู้ใช้ว่า agent อื่นช่วยได้เพิ่มเติม
 * (ไม่ block — แค่แนะนำ)
 */
export function getSoftAdvisory(currentAgentId: string): string | null {
  const advisories: Record<string, string> = {
    'content-creator':
      '💡 ถ้ายังไม่มีข้อมูลแบรนด์ คุยกับ 🏷️ น้องแบรนด์ก่อนจะช่วยให้คอนเทนต์ตรงกลุ่มลูกค้ามากขึ้นนะคะ',
    'campaign-planner':
      '💡 ถ้าอยากรู้ว่าคู่แข่งทำอะไรอยู่ 🔭 น้องดูตลาดช่วยได้ก่อนวางแผนค่ะ',
    'market-insight':
      '💡 เมื่อได้ข้อมูลตลาดแล้ว 📅 น้องแพลนช่วยวางแผนแคมเปญต่อได้เลยค่ะ',
  };
  return advisories[currentAgentId] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility shims — ไม่ให้ legacy imports crash
// (agent-routing.test.ts และ orchestratorEngine เดิมเรียก findBestRoute)
// ─────────────────────────────────────────────────────────────────────────────

export interface JobRequest {
  intent: string;
  keywords: string[];
  masterContext?: any;
  previousOutputs?: any[];
}

// findBestRoute: wraps routeToAgent เพื่อ backward compatibility
export function findBestRoute(request: JobRequest): {
  primaryAgent: string;
  secondaryAgents: string[];
  confidence: number;
  reasoning: string;
  validationRules: string[];
  anticopycat: { needsDedup: boolean; skipAgents: string[] };
} {
  const input = request.intent || request.keywords.join(' ');
  const decision = routeToAgent(input);
  return {
    primaryAgent: decision.primaryAgent.id,
    secondaryAgents: [],
    confidence: decision.confidence,
    reasoning: decision.reasoning,
    validationRules: ['LANGUAGE_TH', 'OUTPUT_READY'],
    anticopycat: { needsDedup: false, skipAgents: [] },
  };
}

// validateAgentOutput: lightweight shim — ใช้ plain string validation แทน object schema
export function validateAgentOutput(
  _agentId: string,
  output: any,
  _context?: any,
  _rules?: any[]
): { passed: boolean; score: number; issues: any[]; recommendations: string[] } {
  const text = typeof output === 'string' ? output : JSON.stringify(output ?? '');
  const notEmpty = text.trim().length > 20;
  const hasThai = /[\u0E00-\u0E7F]/.test(text);

  const issues = [];
  if (!notEmpty) issues.push({ severity: 'critical', message: 'Output ว่างเปล่า' });
  if (!hasThai) issues.push({ severity: 'warning', message: 'ไม่มีภาษาไทย' });

  return {
    passed: notEmpty,
    score: notEmpty ? (hasThai ? 90 : 70) : 0,
    issues,
    recommendations: issues.map(i => i.message),
  };
}
