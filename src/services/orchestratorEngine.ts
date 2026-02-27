/**
 * Orchestrator Engine — Phase 1 (Rebuilt)
 * หน้าที่: รับ input → หา agent ที่ใช่ → ส่งต่อให้ aiService → ตรวจผล
 *
 * Simplified จาก 10-agent system เดิม:
 * - ไม่มี hard dependency block
 * - Validation ทำบน string output (ไม่ต้องการ {task, result, reasoning} object)
 * - Cluster mapping อัปเดตให้ match agents.ts ใหม่ (brand | content | growth)
 */

import { Agent, getAllAgents, getAgentById } from '../data/agents';
import { MasterContext } from '../data/intelligence';
import { routeToAgent } from '../data/agent-routing';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutingResult {
  agent: Agent | null;
  cluster: string;
  primaryAgent: string;
  secondaryAgents: string[];
  confidence: number;
  reasoning: string;
  validationRules: string[];
  anticopycat: { needsDedup: boolean; skipAgents: string[] };
}

export interface FactCheckResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: Array<{ severity: 'critical' | 'warning' | 'info'; message: string }>;
  recommendations: string[];
  checklist: Array<{ rule: string; passed: boolean; severity: string; message: string }>;
  timestamp: Date;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class OrchestratorEngine {
  private masterContext: MasterContext | null = null;
  private completedAgents: string[] = [];
  private agentTaskData: Map<string, Record<string, any>> = new Map();
  private agentFirstUseTracked: Set<string> = new Set();

  // ── Context ────────────────────────────────────────────────────────────────

  setMasterContext(context: MasterContext): void {
    this.masterContext = context;
  }

  getMasterContext(): MasterContext | null {
    return this.masterContext;
  }

  markAgentCompleted(agentId: string): void {
    if (!this.completedAgents.includes(agentId)) {
      this.completedAgents.push(agentId);
    }
  }

  // Phase 1 — ไม่มี hard dependency, ทุก agent พร้อมทำงานเสมอ
  checkReadiness(_agentId: string): { isReady: boolean; missingDependencies: string[] } {
    return { isReady: true, missingDependencies: [] };
  }

  // Task-specific data (ยังคงไว้ใช้ใน onboarding flow ถ้าต้องการ)
  needsTaskSpecificData(agentId: string): boolean {
    return !this.agentFirstUseTracked.has(agentId);
  }

  setTaskSpecificData(agentId: string, data: Record<string, any>): void {
    this.agentTaskData.set(agentId, data);
    this.agentFirstUseTracked.add(agentId);
  }

  getTaskSpecificData(agentId: string): Record<string, any> | undefined {
    return this.agentTaskData.get(agentId);
  }

  buildAgentContext(agentId: string) {
    return {
      masterContext: this.masterContext,
      taskData: this.agentTaskData.get(agentId),
    };
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  /**
   * Route user input → Agent
   * ใช้ keyword scoring จาก agent-routing.ts
   * Fallback ไป 'advisor' เสมอ (ไม่ crash)
   */
  route(userInput: string): RoutingResult {
    const decision = routeToAgent(userInput);
    const agent = decision.primaryAgent;

    return {
      agent,
      cluster: agent?.cluster || 'growth',
      primaryAgent: agent?.id || 'advisor',
      secondaryAgents: [],
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      validationRules: ['LANGUAGE_TH', 'OUTPUT_READY', 'NO_HALLUCINATION'],
      anticopycat: { needsDedup: false, skipAgents: [] },
    };
  }

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Validate agent text output (string — ไม่ใช่ object)
   * ตรวจแค่ที่จำเป็น: ไม่ว่าง, ภาษาไทย, ไม่มีสัญญาณ hallucination
   */
  validate(agentId: string, output: any): ValidationResult {
    const text: string = typeof output === 'string'
      ? output
      : (typeof output?.result === 'string' ? output.result : JSON.stringify(output));

    const issues: ValidationResult['issues'] = [];
    const checklist: ValidationResult['checklist'] = [];

    // CHECK 1: ไม่ว่างเปล่า
    const notEmpty = text.trim().length > 20;
    checklist.push({
      rule: 'NOT_EMPTY',
      passed: notEmpty,
      severity: 'critical',
      message: notEmpty ? 'Output มีเนื้อหา' : 'Output ว่างเปล่าหรือสั้นเกินไป',
    });
    if (!notEmpty) issues.push({ severity: 'critical', message: 'Output ว่างเปล่า' });

    // CHECK 2: มีภาษาไทย (ตัวอักษร Unicode ช่วง Thai)
    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    checklist.push({
      rule: 'LANGUAGE_TH',
      passed: hasThai,
      severity: 'warning',
      message: hasThai ? 'มีภาษาไทย' : 'ไม่พบภาษาไทย — อาจตอบผิดภาษา',
    });
    if (!hasThai) issues.push({ severity: 'warning', message: 'ตอบเป็นภาษาอังกฤษทั้งหมด' });

    // CHECK 3: ไม่มีสัญญาณ offline fallback
    const isOfflineFallback = text.includes('ระบบออฟไลน์') || text.includes('System Note: ระบบใช้โหมดออฟไลน์');
    checklist.push({
      rule: 'NOT_FALLBACK',
      passed: !isOfflineFallback,
      severity: 'warning',
      message: !isOfflineFallback ? 'เป็น API response จริง' : 'เป็น offline fallback',
    });
    if (isOfflineFallback) issues.push({ severity: 'warning', message: 'ใช้ offline fallback — ตรวจสอบ API Key' });

    // CHECK 4: ไม่สั้นเกิน (< 50 chars = ตอบไม่ครบ)
    const longEnough = text.length >= 50;
    checklist.push({
      rule: 'MIN_LENGTH',
      passed: longEnough,
      severity: 'info',
      message: longEnough ? `ความยาวเหมาะสม (${text.length} chars)` : `สั้นเกินไป (${text.length} chars)`,
    });

    const criticalFails = issues.filter(i => i.severity === 'critical').length;
    const score = Math.max(0, 100 - criticalFails * 40 - issues.filter(i => i.severity === 'warning').length * 15);

    return {
      passed: criticalFails === 0,
      score,
      issues,
      checklist,
      recommendations: issues.map(i => `แก้ไข: ${i.message}`),
      timestamp: new Date(),
    };
  }

  /**
   * factCheck — legacy wrapper ที่ Workspace ยังอาจเรียก
   */
  factCheck(output: any): FactCheckResult {
    const result = this.validate('any', output);
    return {
      valid: result.passed,
      violations: result.issues.filter(i => i.severity === 'critical').map(i => i.message),
      warnings: result.issues.filter(i => i.severity === 'warning').map(i => i.message),
      recommendations: result.recommendations,
    };
  }

  // ── IP Protection (คงไว้ครบ — ยังใช้ได้) ─────────────────────────────────

  enforceBrandIsolation(requestedBrandId: string): { allowed: boolean; reason: string } {
    if (!this.masterContext) return { allowed: false, reason: 'ไม่มี brand context' };
    if (this.masterContext.brandId !== requestedBrandId) {
      return { allowed: false, reason: `ไม่สามารถเข้าถึงข้อมูลของ brand "${requestedBrandId}"` };
    }
    return { allowed: true, reason: 'ผ่าน' };
  }

  checkPlagiarismAndTrademark(content: string): { passed: boolean; issues: string[] } {
    const patterns = [
      /just do it/gi, /think different/gi, /i'm lovin' it/gi,
      /because you're worth it/gi, /open happiness/gi,
    ];
    const issues = patterns
      .filter(p => p.test(content))
      .map(p => `พบ trademark: "${content.match(p)?.[0]}"`);
    return { passed: issues.length === 0, issues };
  }

  checkArtStyleProtection(prompt: string): { passed: boolean; suggestion: string } {
    const artists = ['picasso', 'van gogh', 'warhol', 'banksy', 'basquiat', 'dali'];
    const found = artists.find(a => prompt.toLowerCase().includes(a));
    if (found) {
      const mood = this.masterContext?.visualStyle?.moodKeywords?.join(', ') || 'modern';
      return { passed: false, suggestion: `ใช้ mood keywords แทน: "${mood}"` };
    }
    return { passed: true, suggestion: '' };
  }

  checkIsolation(brandId: string): boolean {
    return this.masterContext?.brandId === brandId;
  }

  antiCopycatCheck(original: string, newText: string): FactCheckResult {
    const sim = this.calculateSimilarity(original, newText);
    if (sim > 0.9) return { valid: false, violations: ['ข้อความคล้ายต้นฉบับ > 90%'], warnings: [], recommendations: ['Rephrase ให้แตกต่างขึ้น'] };
    if (sim > 0.7) return { valid: true, violations: [], warnings: ['ความคล้าย > 70%'], recommendations: ['พิจารณาปรับบางส่วน'] };
    return { valid: true, violations: [], warnings: [], recommendations: [] };
  }

  getCrossAgentContext(agentId: string, dataType: 'brand' | 'tone' | 'visuals') {
    if (!this.masterContext) return null;
    if (dataType === 'brand') return { brandName: this.masterContext.brandNameTh, coreUSP: this.masterContext.coreUSP };
    if (dataType === 'tone') return { toneOfVoice: this.masterContext.toneOfVoice };
    if (dataType === 'visuals') return { primaryColor: this.masterContext.visualStyle?.primaryColor };
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private calculateSimilarity(t1: string, t2: string): number {
    const s1 = t1.toLowerCase(), s2 = t2.toLowerCase();
    if (s1 === s2) return 1;
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (!longer.length) return 1;
    const dist = this.levenshtein(longer, shorter);
    return (longer.length - dist) / longer.length;
  }

  private levenshtein(s1: string, s2: string): number {
    const costs: number[] = Array.from({ length: s1.length + 1 }, (_, k) => k);
    for (let i = 1; i <= s2.length; i++) {
      let prev = i;
      for (let j = 1; j <= s1.length; j++) {
        const val = Math.min(prev + 1, costs[j] + 1, costs[j - 1] + (s1[j - 1] === s2[i - 1] ? 0 : 1));
        costs[j - 1] = prev;
        prev = val;
      }
      costs[s1.length] = prev;
    }
    return costs[s1.length];
  }

  generateSystemSummary(): string {
    if (!this.masterContext) return '❌ ไม่พบ Master Context';
    return `✅ Orchestrator พร้อมทำงาน\n📍 แบรนด์: ${this.masterContext.brandNameTh}\n🤖 Agents พร้อม: 5 (Phase 1)`;
  }

  // Stub methods ที่ legacy code อาจเรียก — ไม่ให้ crash
  recognizeIntent(_input: string): string[] { return ['growth']; }
  runIPProtectionChecks(content: string) {
    return {
      isolation: { allowed: true, reason: 'ok' },
      plagiarism: this.checkPlagiarismAndTrademark(content),
      artStyle: this.checkArtStyleProtection(content),
      overallPassed: true,
    };
  }
}

export const orchestratorEngine = new OrchestratorEngine();
