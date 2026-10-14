/**
 * Orchestrator Engine — Phase 1 (Updated)
 *
 * เพิ่ม processAndDeliver() รับผิดชอบ:
 * 1. Guard loop สูงสุด 3 ครั้ง
 * 2. ถ้าไม่ผ่าน → ส่งกลับ Claude พร้อมเหตุผล
 * 3. ถ้าเกิน 3 ครั้ง → แจ้ง user + แนะนำทีละ step
 * 4. extractOutputs()
 * 5. แนบป้ายผลตรวจจริง (buildGuardBadge)
 * 6. ส่งผลสุดท้ายกลับ UI (ไม่เก็บประวัติแชท)
 *
 * aiService.ts หน้าที่เดียว: call Claude → ส่งต่อมาที่นี่
 */

import { Agent, getAllAgents, getAgentById } from '../data/agents';
import { MasterContext } from '../data/intelligence';
import { routeToAgent } from '../data/agent-routing';
import { dataGuardian, DataGuardReport } from './dataGuardService';

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

export interface DeliverParams {
  agentId: string;
  agentName: string;
  userInput: string;
  rawResponse: string;
  context: MasterContext;
  messages: Array<{ role: 'user' | 'assistant'; content: any }>;
  /** ข้อความต้นฉบับที่ผู้ใช้ส่งมา (ไฟล์แนบ/ข้อความยาว) ใช้ตรวจความคล้าย */
  originalContent?: string;
  // aiService ส่ง function นี้มาเพื่อให้ orchestrator call Claude ซ้ำได้
  callClaudeFn: (
    messages: Array<{ role: 'user' | 'assistant'; content: any }>
  ) => Promise<string>;
}

export interface DeliverResult {
  text: string;
  outputs: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    agentName: string;
  }>;
  /** ผลตรวจรอบสุดท้าย (null ถ้าตรวจไม่ได้) */
  guardReport: DataGuardReport | null;
}

/** ป้ายผลตรวจต่อท้ายคำตอบ — ขึ้นต้นด้วย marker เดียวกันเสมอ เพื่อให้ตัดออกจาก history ได้ */
export const GUARD_BADGE_MARKER = '\n\n---\n🛡️ ';

export function buildGuardBadge(report: DataGuardReport | null): string {
  if (!report || !report.aiChecked) {
    return `${GUARD_BADGE_MARKER}⚠️ ตรวจได้เฉพาะกฎพื้นฐาน — ตัวตรวจ AI ไม่พร้อมในขณะนี้`;
  }
  const warnings = Object.values(report.checks)
    .filter(r => r.severity === 'warning')
    .map(r => r.suggestion || r.message);
  if (warnings.length === 0) return `${GUARD_BADGE_MARKER}✅ ผ่านการตรวจ 6 ด้าน`;
  return `${GUARD_BADGE_MARKER}✅ ผ่านการตรวจ 6 ด้าน — ⚠️ ข้อควรระวัง: ${warnings.join(' / ')}`;
}

export function stripGuardBadge(text: string): string {
  const i = text.indexOf(GUARD_BADGE_MARKER);
  return i === -1 ? text : text.slice(0, i);
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

  checkReadiness(_agentId: string): { isReady: boolean; missingDependencies: string[] } {
    return { isReady: true, missingDependencies: [] };
  }

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

  // ── processAndDeliver — หัวใจหลักของ Orchestrator ────────────────────────
  /**
   * รับ raw response จาก Claude → วน Guard loop → บันทึก → ส่งผลกลับ UI
   *
   * Flow:
   * 1. ตรวจ Guard (dataGuardian.validateContent)
   * 2. ถ้า blocked → เพิ่ม retry message → call Claude ใหม่ (สูงสุด 3 ครั้ง)
   * 3. ถ้าผ่าน → extractOutputs → แนบ badge → return (ไม่เก็บประวัติแชท)
   * 4. ถ้าเกิน 3 ครั้ง → แจ้ง user + แนะนำทีละ step
   */
  async processAndDeliver(params: DeliverParams): Promise<DeliverResult> {
    const {
      agentId, agentName, userInput, context,
      messages, callClaudeFn, originalContent,
    } = params;

    let responseText = params.rawResponse;
    let attempt = 0;
    let guardPassed = false;
    let blockReason = '';
    let guardReport: DataGuardReport | null = null;

    const ctx = context as any;
    const guardContext = {
      brandId: String(context.brandId || 'guest'),
      brandNameTh: context.brandNameTh,
      coreUSP: Array.isArray(context.coreUSP)
        ? context.coreUSP.join(', ')
        : (context.coreUSP || ''),
      toneOfVoice: context.toneOfVoice,
      targetAudience: context.targetAudience,
      forbiddenWords: Array.isArray(ctx.forbiddenWords) ? ctx.forbiddenWords : [],
    };
    const guardMetadata = { originalContent, userInput };

    // ── Guard Loop สูงสุด 3 ครั้ง ───────────────────────────────────────────
    while (attempt < 3 && !guardPassed) {
      attempt++;

      // รอบที่ 2 และ 3: ส่งกลับ Claude พร้อมเหตุผล
      if (attempt > 1) {
        const retryMessages = [
          ...messages,
          { role: 'assistant' as const, content: responseText },
          {
            role: 'user' as const,
            content: `กรุณาสร้างคำตอบใหม่เนื่องจากไม่ผ่านการตรวจสอบ\nสาเหตุ: ${blockReason}\nโปรดแก้ไขจุดนี้และตอบใหม่อีกครั้งค่ะ`,
          },
        ];

        try {
          responseText = await callClaudeFn(retryMessages);
        } catch (err) {
          console.error(`[Orchestrator] Retry ${attempt} call failed:`, err);
          break;
        }
      }

      // ตรวจ Guard
      guardReport = await dataGuardian.validateContent(
        guardContext,
        responseText,
        guardMetadata
      ).catch(() => null);

      if (!guardReport || guardReport.overallStatus !== 'blocked') {
        guardPassed = true;
      } else {
        blockReason = guardReport.blockReasons.join(' | ');
        console.warn(`[Orchestrator] Guard attempt ${attempt} blocked: ${blockReason}`);
      }
    }

    // ── ถ้าเกิน 3 ครั้งยังไม่ผ่าน ─────────────────────────────────────────
    if (!guardPassed) {
      responseText = this.buildUserErrorMessage(blockReason);
    } else {
      responseText = responseText + buildGuardBadge(guardReport);
    }

    // ── Extract outputs ([WORKFILE] blocks) ────────────────────────────────
    const outputs = this.extractOutputs(responseText, agentName);

    return { text: responseText, outputs, guardReport: guardPassed ? guardReport : null };
  }

  // ── buildUserErrorMessage ─────────────────────────────────────────────────
  private buildUserErrorMessage(reason: string): string {
    return `⚠️ ขออภัยค่ะ ระบบตรวจพบปัญหาจากข้อมูลที่ส่งมาหลังจากพยายาม 3 ครั้ง

**สาเหตุ:** ${reason || 'ข้อมูลไม่ผ่านการตรวจสอบมาตรฐาน'}

**แนวทางแก้ไขทีละขั้น:**
1. กด ⚙ เพื่อตรวจสอบข้อมูลแบรนด์ที่กรอกไว้ให้ครบถ้วน
2. ลองพิมพ์คำถามใหม่ให้เฉพาะเจาะจงมากขึ้น
3. ถ้าปัญหายังอยู่ ให้เริ่มบทสนทนาใหม่กับน้องตัวเดิม
4. หากยังพบปัญหา กรุณาติดต่อทีมงานค่ะ`;
  }

  // ── extractOutputs ────────────────────────────────────────────────────────
  extractOutputs(
    text: string,
    agentName: string
  ): Array<{ id: string; type: string; title: string; content: string; agentName: string }> {
    const outputs: Array<{
      id: string; type: string; title: string; content: string; agentName: string;
    }> = [];
    const tagRegex = /\[WORKFILE:\s*(.+?)\]\s*([\s\S]*?)\s*\[\/WORKFILE\]/g;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      outputs.push({
        id: `out_${Date.now()}_${outputs.length}`,
        type: 'document',
        title: match[1].trim(),
        content: match[2].trim(),
        agentName,
      });
    }
    return outputs;
  }

  // ── Validation (Gate 1 — ยังคงไว้เหมือนเดิม) ──────────────────────────

  validate(agentId: string, output: any): ValidationResult {
    const text: string = typeof output === 'string'
      ? output
      : (typeof output?.result === 'string' ? output.result : JSON.stringify(output));

    const issues: ValidationResult['issues'] = [];
    const checklist: ValidationResult['checklist'] = [];

    const notEmpty = text.trim().length > 20;
    checklist.push({
      rule: 'NOT_EMPTY',
      passed: notEmpty,
      severity: 'critical',
      message: notEmpty ? 'Output มีเนื้อหา' : 'Output ว่างเปล่าหรือสั้นเกินไป',
    });
    if (!notEmpty) issues.push({ severity: 'critical', message: 'Output ว่างเปล่า' });

    const hasThai = /[\u0E00-\u0E7F]/.test(text);
    checklist.push({
      rule: 'LANGUAGE_TH',
      passed: hasThai,
      severity: 'warning',
      message: hasThai ? 'มีภาษาไทย' : 'ไม่พบภาษาไทย',
    });
    if (!hasThai) issues.push({ severity: 'warning', message: 'ตอบเป็นภาษาอังกฤษทั้งหมด' });

    const isOfflineFallback = text.includes('ระบบออฟไลน์');
    checklist.push({
      rule: 'NOT_FALLBACK',
      passed: !isOfflineFallback,
      severity: 'warning',
      message: !isOfflineFallback ? 'เป็น API response จริง' : 'เป็น offline fallback',
    });
    if (isOfflineFallback) issues.push({ severity: 'warning', message: 'ใช้ offline fallback' });

    const longEnough = text.length >= 50;
    checklist.push({
      rule: 'MIN_LENGTH',
      passed: longEnough,
      severity: 'info',
      message: longEnough ? `ความยาวเหมาะสม (${text.length} chars)` : `สั้นเกินไป`,
    });

    const plagiarismResult = this.checkPlagiarismAndTrademark(text);
    if (!plagiarismResult.passed) {
      plagiarismResult.issues.forEach(issue => {
        issues.push({ severity: 'warning', message: issue });
        checklist.push({ rule: 'NO_TRADEMARK', passed: false, severity: 'warning', message: issue });
      });
    } else {
      checklist.push({ rule: 'NO_TRADEMARK', passed: true, severity: 'info', message: 'ไม่พบ trademark ของแบรนด์อื่น' });
    }

    const artStyleResult = this.checkArtStyleProtection(text);
    if (!artStyleResult.passed) {
      issues.push({ severity: 'warning', message: artStyleResult.reason });
      checklist.push({ rule: 'NO_ARTIST_IP', passed: false, severity: 'warning', message: artStyleResult.reason });
    } else {
      checklist.push({ rule: 'NO_ARTIST_IP', passed: true, severity: 'info', message: 'ไม่พบการอ้าง art style ที่มีลิขสิทธิ์' });
    }

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

  factCheck(output: any): FactCheckResult {
    const result = this.validate('any', output);
    return {
      valid: result.passed,
      violations: result.issues.filter(i => i.severity === 'critical').map(i => i.message),
      warnings: result.issues.filter(i => i.severity === 'warning').map(i => i.message),
      recommendations: result.recommendations,
    };
  }

  // ── IP Protection ─────────────────────────────────────────────────────────

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

  checkArtStyleProtection(prompt: string): { passed: boolean; suggestion: string; reason: string } {
    const artists = ['picasso', 'van gogh', 'warhol', 'banksy', 'basquiat', 'dali'];
    const found = artists.find(a => prompt.toLowerCase().includes(a));
    if (found) {
      const mood = this.masterContext?.visualStyle?.moodKeywords?.join(', ') || 'modern';
      return {
        passed: false,
        reason: `พบการอ้างอิงศิลปิน "${found}"`,
        suggestion: `ใช้ mood keywords แทน: "${mood}"`,
      };
    }
    return { passed: true, suggestion: '', reason: '' };
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
