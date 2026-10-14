/**
 * AI Service — Agent Ranger 2 Phase 1 (Updated)
 *
 * หน้าที่หลัก:
 * 1. buildContextMessage() — inject ข้อมูล brand ครบทุกฟิลด์
 * 2. callClaudeAPI() — call /api/anthropic เท่านั้น (model/max_tokens กำหนดฝั่ง server)
 * 3. ส่งต่อ orchestratorEngine.processAndDeliver() ทำงานต่อทั้งหมด
 *    (Guard loop, saveMessage, extractOutputs, badge)
 * 4. ถ้า Claude ตอบไม่ได้ → แจ้ง error ตามสาเหตุจริง ไม่ผ่าน Guard และไม่ติดป้ายผลตรวจ
 *
 * ไม่มี Guard logic ใน aiService อีกต่อไป
 */

import { Agent, getAgentById } from '../data/agents';
import { MasterContext } from '../data/intelligence';
import { orchestratorEngine, stripGuardBadge } from './orchestratorEngine';
import { databaseService, MessageRecord } from './databaseService';
import { getDeviceId } from './deviceId';

// ── Ranger ID → Agent ID ──────────────────────────────────────────────────────
const RANGER_TO_AGENT: Record<string, string> = {
  'brand':     'brand-builder',
  'content':   'content-creator',
  'planning':  'campaign-planner',
  'marketing': 'market-insight',
  'consult':   'advisor',
  'brand-builder':    'brand-builder',
  'content-creator':  'content-creator',
  'campaign-planner': 'campaign-planner',
  'market-insight':   'market-insight',
  'advisor':          'advisor',
};

/** ยอดเครดิตที่ server ส่งกลับ (ไม่มีถ้าปิดระบบเครดิต หรือเป็นรอบ retry) */
export interface CreditInfo {
  cost: number;
  used: number;
  remaining: number;
  limit: number;
  resetsAt: string;
}

export interface SendMessageResponse {
  text: string;
  credits?: CreditInfo;
  /** ไม่มีค่าแล้ว — เดิมเป็นเลข 95 ที่เขียนตายตัว ไม่ได้วัดจากอะไร */
  confidence?: number;
  /** false เมื่อ Claude ตอบไม่ได้ (text เป็นข้อความแจ้ง error) */
  ok: boolean;
  factCheckResult?: { valid: boolean; violations: string[]; warnings: string[] };
  outputs?: Array<{ id: string; type: string; title: string; content: string; agentName: string }>;
}

export interface ProcessMessageRequest {
  userInput: string;
  context?: MasterContext;
  forceAgent?: string;
  attachments?: Array<{ name: string; type: string; size: number; data?: string }>;
}

export interface ProcessMessageResponse {
  content: string;
  agentId: string;
  agentName: string;
  confidence?: number;
  factCheckResult: { valid: boolean; violations: string[]; warnings: string[] };
  outputs?: Array<{ id: string; type: string; title: string; content: string; agentName: string }>;
}

export class ClaudeApiError extends Error {
  constructor(public code: string, message: string, public credits?: CreditInfo) {
    super(message);
    this.name = 'ClaudeApiError';
  }
}

export { getDeviceId };

function apiHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const id = getDeviceId();
  if (id) h['X-Ranger-User'] = id;
  return h;
}

/** ยอดเครดิตวันนี้ — ใช้แสดงก่อนผู้ใช้ส่งข้อความ */
export async function fetchCreditBalance(): Promise<(Omit<CreditInfo, 'cost'> & { enabled: boolean }) | null> {
  try {
    const res = await fetch('/api/credits', { headers: apiHeaders(false) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const API_ERROR_PREFIX = '⚠️ ยังตอบไม่ได้ในขณะนี้';

/** ข้อความแจ้งผู้ใช้เมื่อเรียก Claude ไม่สำเร็จ — บอกสาเหตุจริง ไม่ใช่คำตอบปลอม */
export function buildApiErrorMessage(code: string): string {
  const reasons: Record<string, string> = {
    rate_limited: 'คุณส่งข้อความถี่เกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ',
    upstream_rate_limited: 'ระบบ AI มีผู้ใช้งานหนาแน่น กรุณาลองใหม่ในอีกสักครู่ค่ะ',
    overloaded: 'ระบบ AI ไม่พร้อมชั่วคราว กรุณาลองใหม่ในอีกสักครู่ค่ะ',
    timeout: 'ระบบ AI ตอบช้าเกินกำหนด กรุณาลองใหม่ หรือถามให้สั้นลงค่ะ',
    auth: 'ระบบยังเชื่อมต่อ AI ไม่ได้ (API key ไม่ถูกต้อง) กรุณาแจ้งทีมงานค่ะ',
    billing: 'ระบบยังเชื่อมต่อ AI ไม่ได้ (เครดิต API หมด) กรุณาแจ้งทีมงานค่ะ',
    not_configured: 'ระบบยังไม่ได้ตั้งค่า API key กรุณาแจ้งทีมงานค่ะ',
    quota_exceeded: 'เครดิตวันนี้ใช้ครบแล้ว จะได้เครดิตใหม่ตอนเที่ยงคืน (เวลาไทย) ค่ะ',
    daily_user_cap: 'ช่วงเปิดทดลอง ระบบรับผู้ใช้จำนวนจำกัดต่อวัน และวันนี้เต็มแล้ว ลองใหม่หลังเที่ยงคืนนะคะ',
    ip_user_limit: 'เครือข่ายอินเทอร์เน็ตนี้มีผู้ใช้ครบจำนวนต่อวันแล้ว ลองใหม่หลังเที่ยงคืน หรือเปลี่ยนเครือข่ายค่ะ',
    invalid_request: 'ข้อความหรือไฟล์แนบมีรูปแบบที่ระบบไม่รองรับ (อาจยาวหรือใหญ่เกินไป) กรุณาลองใหม่ค่ะ',
    refusal: 'AI ไม่สามารถตอบคำถามนี้ได้ ลองปรับคำถามใหม่ค่ะ',
    empty: 'AI ไม่ได้ส่งคำตอบกลับมา กรุณาลองใหม่ค่ะ',
  };
  return `${API_ERROR_PREFIX}\n\n${reasons[code] || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ AI กรุณาลองใหม่ค่ะ'}`;
}

class AIService {
  private masterContext: MasterContext | null = null;
  private chatHistories: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();

  // ── initialize ────────────────────────────────────────────────────────────
  initialize(context: MasterContext): void {
    this.masterContext = context;
    orchestratorEngine.setMasterContext(context);
  }

  // ── sendMessage ───────────────────────────────────────────────────────────
  async sendMessage(
    rangerId: string,
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: MasterContext,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): Promise<SendMessageResponse> {

    if (context) this.initialize(context);
    const ctx = this.masterContext || this.buildDefaultContext();

    const agentId = RANGER_TO_AGENT[rangerId] || 'advisor';
    const agent = getAgentById(agentId);
    if (!agent) throw new Error(`ไม่พบ Ranger: ${rangerId}`);

    // รหัสแบรนด์ฝั่ง browser — server ตรวจว่าเป็นแบรนด์ของเครื่องนี้ก่อนบันทึก
    const brandKey = ctx.brandId && String(ctx.brandId) !== 'guest' ? String(ctx.brandId) : '';

    // ── บันทึก user message ────────────────────────────────────────────────
    if (brandKey) {
      const userMsg: MessageRecord = {
        brandId: brandKey,
        role: 'user',
        agentId,
        agentName: agent.name,
        content: text,
        attachments: attachments?.map(f => ({ name: f.name, type: f.type, size: f.size })),
        createdAt: new Date(),
      };
      // user message บันทึกทันที ไม่รอ
      databaseService.saveMessage(userMsg).catch(() => {});
    }

    // ── build context + messages ───────────────────────────────────────────
    // ข้อมูลแบรนด์อยู่ใน system prompt ที่เดียว (เดิมส่งซ้ำในข้อความแรกด้วย)
    const contextMsg = this.buildContextMessage(agent, ctx);
    const system = `${agent.systemPrompt}\n\n---\n${contextMsg}`;
    const messages = this.buildMessages(text, history, attachments);

    // ── Gate 1: validate input ─────────────────────────────────────────────
    const inputValidation = orchestratorEngine.validate(agentId, text);
    if (!inputValidation.passed) {
      const criticals = inputValidation.issues.filter(i => i.severity === 'critical');
      if (criticals.length > 0) {
        console.warn(`[Gate1] Input validation failed:`, criticals.map(i => i.message));
      }
    }

    // ── Call Claude ────────────────────────────────────────────────────────
    let rawResponse: string;
    let credits: CreditInfo | undefined;
    let turnId: string | undefined;
    try {
      const first = await this.callClaudeAPI(system, messages);
      rawResponse = first.text;
      credits = first.credits;
      turnId = first.turnId;
    } catch (err: any) {
      const code = err instanceof ClaudeApiError ? err.code : 'network';
      console.error('[AIService] callClaudeAPI failed:', code, err?.message);
      // ไม่ส่งเข้า Guard และไม่ติดป้าย — ผู้ใช้ต้องรู้ว่า AI ไม่ได้ตอบ
      return {
        text: buildApiErrorMessage(code),
        ok: false,
        outputs: [],
        credits: err instanceof ClaudeApiError ? err.credits : undefined,
      };
    }

    // ── ส่งต่อ Orchestrator ทำงานต่อทั้งหมด ───────────────────────────────
    // (Guard loop, saveMessage agent response, extractOutputs, badge)
    const result = await orchestratorEngine.processAndDeliver({
      agentId,
      agentName: agent.name,
      userInput: text,
      rawResponse,
      context: ctx,
      brandKey,
      messages,
      originalContent: this.collectOriginalContent(text, attachments),
      // รอบที่ Guard สั่งแก้ ส่ง turnId เดิม — server ไม่หักเครดิต
      callClaudeFn: async (retryMessages) => (await this.callClaudeAPI(system, retryMessages, turnId)).text,
    });

    // ── อัปเดต in-memory history ───────────────────────────────────────────
    const agentHistory = this.chatHistories.get(agentId) || [];
    this.chatHistories.set(agentId, [
      ...agentHistory,
      { role: 'user' as const, content: text },
      { role: 'assistant' as const, content: result.text },
    ].slice(-20));

    const report = result.guardReport;
    const checks = report ? Object.values(report.checks) : [];
    return {
      text: result.text,
      ok: true,
      credits,
      outputs: result.outputs,
      factCheckResult: report
        ? {
            valid: report.overallStatus !== 'blocked',
            violations: checks.filter(c => !c.passed && c.severity === 'error').map(c => c.message),
            warnings: checks.filter(c => c.severity === 'warning').map(c => c.message),
          }
        : undefined,
    };
  }

  // ── buildContextMessage — inject brand data ครบทุกฟิลด์ ──────────────────
  private buildContextMessage(agent: Agent, ctx: MasterContext): string {
    const hasRealData = !ctx.isDefault && ctx.brandNameTh && ctx.brandNameTh !== 'ลูกค้าทั่วไป';
    const usps = Array.isArray(ctx.coreUSP) ? ctx.coreUSP : [ctx.coreUSP];

    let msg = `## ข้อมูลธุรกิจของผู้ใช้`;

    // ── Bucket 1: Strategy ─────────────────────────────────────────────────
    msg += `\n- ชื่อแบรนด์: ${ctx.brandNameTh}${ctx.brandNameEn ? ` (${ctx.brandNameEn})` : ''}`;
    msg += `\n- อุตสาหกรรม: ${ctx.industry || 'ไม่ระบุ'}`;
    if (ctx.businessModel) msg += `\n- รูปแบบธุรกิจ: ${ctx.businessModel}`;
    msg += `\n- จุดเด่น (USP): ${usps.filter(Boolean).join(', ') || 'ไม่ระบุ'}`;
    if ((ctx as any).competitors?.length) msg += `\n- คู่แข่ง: ${(ctx as any).competitors.join(', ')}`;

    // ── Bucket 2: Visual/Creative ──────────────────────────────────────────
    msg += `\n\n## อัตลักษณ์ทางภาพ`;
    msg += `\n- สีหลัก: ${ctx.visualStyle?.primaryColor || 'ไม่ระบุ'}`;
    if (ctx.visualStyle?.secondaryColors?.length)
      msg += `\n- สีรอง: ${ctx.visualStyle.secondaryColors.join(', ')}`;
    if (ctx.visualStyle?.fontFamily?.length)
      msg += `\n- ฟอนต์: ${Array.isArray(ctx.visualStyle.fontFamily) ? ctx.visualStyle.fontFamily.join(', ') : ctx.visualStyle.fontFamily}`;
    if (ctx.visualStyle?.moodKeywords?.length)
      msg += `\n- Mood: ${ctx.visualStyle.moodKeywords.join(', ')}`;
    if (ctx.visualStyle?.videoStyle)
      msg += `\n- สไตล์วิดีโอ: ${ctx.visualStyle.videoStyle}`;
    if (ctx.visualStyle?.forbiddenElements?.length)
      msg += `\n- ห้ามใช้ภาพ/สไตล์: ${ctx.visualStyle.forbiddenElements.join(', ')}`;

    // ── Bucket 3: Growth/Communication ────────────────────────────────────
    msg += `\n\n## กลุ่มเป้าหมายและการสื่อสาร`;
    msg += `\n- กลุ่มลูกค้า: ${ctx.targetAudience || 'ไม่ระบุ'}`;
    if ((ctx as any).targetPersona) msg += `\n- Persona: ${(ctx as any).targetPersona}`;
    if ((ctx as any).painPoints?.length)
      msg += `\n- Pain Points: ${(ctx as any).painPoints.join(', ')}`;
    msg += `\n- โทนเสียง: ${ctx.toneOfVoice || 'professional'}`;
    if ((ctx as any).forbiddenWords?.length)
      msg += `\n- คำต้องห้าม: ${(ctx as any).forbiddenWords.join(', ')}`;
    if ((ctx as any).brandHashtags?.length)
      msg += `\n- แฮชแท็กประจำแบรนด์: ${(ctx as any).brandHashtags.join(', ')}`;

    if (!hasRealData) {
      msg += `\n\n⚠️ ยังไม่มีข้อมูลแบรนด์ที่สมบูรณ์ — ให้ถามผู้ใช้เพิ่มเติม`;
    }

    msg += `\n\n## คำสั่งสำหรับ ${agent.name}`;
    msg += `\n1. ตอบเป็นภาษาไทยเป็นหลัก`;
    msg += hasRealData
      ? `\n2. ข้อมูลแบรนด์ด้านบนผู้ใช้กรอกไว้แล้ว ใช้ทุกครั้ง ห้ามถามซ้ำ และอย่าสมมติข้อมูลเอง`
      : `\n2. ใช้ข้อมูลแบรนด์เท่าที่มี อย่าสมมติข้อมูลเอง`;
    msg += `\n3. ถ้าคำถามใน "ถามก่อน" ของคุณมีคำตอบอยู่ในข้อมูลแบรนด์แล้ว ให้ข้ามข้อนั้น ถามเฉพาะสิ่งที่งานนี้ต้องใช้แต่ยังไม่มี (เช่น platform, ระยะเวลา) หรือช่องที่เขียนว่า "ไม่ระบุ"`;
    msg += `\n4. สร้าง output ที่ copy ไปใช้งานได้เลย ไม่ใช่แค่ทฤษฎี`;
    msg += `\n5. ถามทีละ 1-2 คำถาม ไม่ถามทีเดียวหลายข้อ`;
    msg += `\n6. ตอบตรงๆ กระชับ ไม่เกริ่นยาว`;
    msg += `\n7. ห้ามแต่งตัวเลขสถิติหรือผลวิจัย ถ้าจะอ้างตัวเลขต้องบอกแหล่งที่มา หรือบอกว่าเป็นการประมาณการ`;

    return msg;
  }

  // ── buildMessages ─────────────────────────────────────────────────────────
  private buildMessages(
    userInput: string,
    uiHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): Array<{ role: 'user' | 'assistant'; content: any }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

    const imageAttachments = attachments?.filter(a => a.type.startsWith('image/') && a.data) || [];
    const textAttachments = attachments?.filter(a => !a.type.startsWith('image/') && a.data) || [];

    const buildUserContent = (text: string): any => {
      if (imageAttachments.length === 0 && textAttachments.length === 0) {
        return text;
      }

      const contentArr: any[] = [{ type: 'text', text }];

      imageAttachments.forEach(att => {
        const base64 = att.data?.split(',')[1] || att.data || '';
        const mediaType = att.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
        contentArr.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        });
      });

      textAttachments.forEach(att => {
        const decoded = this.decodeTextAttachment(att);
        if (decoded !== null) {
          contentArr.push({ type: 'text', text: `\n\n[ไฟล์แนบ: ${att.name}]\n${decoded}` });
        }
      });

      return contentArr;
    };

    if (uiHistory.length > 0) {
      // ตัดป้ายผลตรวจออกจาก history — ไม่ต้องส่งให้ Claude อ่านซ้ำ (ประหยัด token)
      let valid = uiHistory
        .map(m => ({ role: m.role, content: m.role === 'assistant' ? stripGuardBadge(m.content) : m.content }))
        .filter(m => typeof m.content === 'string' && m.content.trim().length > 0)
        // ข้อความแจ้ง error ไม่ใช่คำตอบจริง — ไม่ส่งกลับเข้า context
        .filter(m => !(m.role === 'assistant' && m.content.startsWith(API_ERROR_PREFIX)));
      if (valid[0]?.role !== 'user') valid = valid.slice(1);
      const trimmed: typeof valid = [];
      for (const m of valid) {
        const last = trimmed[trimmed.length - 1];
        if (!last || last.role !== m.role) trimmed.push(m);
      }
      let sliced = trimmed.slice(-10);
      if (sliced[0]?.role !== 'user') sliced = sliced.slice(1);
      // ข้อความถัดไปเป็น user — ถ้า history จบด้วย user ให้ตัดออก (กัน user ซ้อนกัน)
      if (sliced[sliced.length - 1]?.role === 'user') sliced = sliced.slice(0, -1);
      messages.push(...sliced);
    }
    messages.push({ role: 'user', content: buildUserContent(userInput) });

    return messages;
  }

  private decodeTextAttachment(att: { type: string; data?: string }): string | null {
    const rawText = att.data?.split(',').slice(1).join(',') || '';
    try {
      if (att.type !== 'text/plain') return rawText;
      // atob ให้ binary string — แปลงเป็น UTF-8 เพื่อให้ภาษาไทยไม่เพี้ยน
      const bin = atob(rawText);
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  /** ข้อความต้นฉบับจากผู้ใช้ (ไฟล์แนบ + ข้อความยาว) สำหรับ Guard ตรวจความคล้าย */
  private collectOriginalContent(
    text: string,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): string {
    const parts = (attachments || [])
      .filter(a => !a.type.startsWith('image/') && a.data)
      .map(a => this.decodeTextAttachment(a))
      .filter((t): t is string => !!t);
    if (text.length >= 200) parts.unshift(text);
    return parts.join('\n\n');
  }

  // ── callClaudeAPI — call /api/anthropic เท่านั้น ─────────────────────────
  // API key, model, max_tokens และ web search ถูกกำหนดฝั่ง server (api/anthropic.js)
  async callClaudeAPI(
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: any }>,
    turnId?: string
  ): Promise<{ text: string; credits?: CreditInfo; turnId?: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      let res: Response;
      try {
        res = await fetch('/api/anthropic', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(turnId ? { system, messages, turnId } : { system, messages }),
          signal: controller.signal,
        });
      } catch (err: any) {
        throw new ClaudeApiError(err?.name === 'AbortError' ? 'timeout' : 'network', String(err?.message || err));
      }

      const data = await res.json().catch(() => null) as any;
      if (!res.ok) {
        const code = data?.error?.code || (res.status === 413 ? 'invalid_request' : `http_${res.status}`);
        throw new ClaudeApiError(code, data?.error?.message || `HTTP ${res.status}`, data?.credits || undefined);
      }
      if (data?.stopReason === 'refusal') throw new ClaudeApiError('refusal', 'refused');
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text) throw new ClaudeApiError('empty', `empty response (${data?.stopReason})`);
      return { text, credits: data?.credits || undefined, turnId: data?.turnId || undefined };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── buildDefaultContext ───────────────────────────────────────────────────
  private buildDefaultContext(): MasterContext {
    return {
      brandId: 'guest',
      brandNameTh: 'แบรนด์ของคุณ',
      brandNameEn: 'Your Brand',
      industry: 'ธุรกิจทั่วไป',
      coreUSP: ['คุณภาพดี'],
      visualStyle: { primaryColor: '#5E9BEB', moodKeywords: ['professional'] },
      targetAudience: 'ผู้ใช้ทั่วไป',
      toneOfVoice: 'professional',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isDefault: true,
    } as any;
  }

  // ── processMessage (wrapper สำหรับ AgentChat + AgentsGrid) ───────────────
  async processMessage(req: ProcessMessageRequest): Promise<ProcessMessageResponse> {
    const { userInput, context, forceAgent, attachments } = req;

    if (context) this.initialize(context);
    const ctx = this.masterContext || this.buildDefaultContext();

    const agentId = forceAgent
      ? (RANGER_TO_AGENT[forceAgent] || forceAgent)
      : 'advisor';
    const agent = getAgentById(agentId);
    if (!agent) throw new Error(`ไม่พบ Agent: ${agentId}`);

    const history = this.chatHistories.get(agentId) || [];
    const result = await this.sendMessage(agentId, userInput, history, ctx, attachments);

    return {
      content: result.text,
      agentId,
      agentName: agent.name,
      confidence: result.confidence,
      factCheckResult: result.factCheckResult || { valid: result.ok, violations: [], warnings: [] },
      outputs: result.outputs,
    };
  }

  // ── Public helpers ────────────────────────────────────────────────────────
  clearHistory(): void {
    this.chatHistories.clear();
  }

  clearAgentHistory(agentId: string): void {
    const resolvedId = RANGER_TO_AGENT[agentId] || agentId;
    this.chatHistories.delete(resolvedId);
  }
}

export const aiService = new AIService();
