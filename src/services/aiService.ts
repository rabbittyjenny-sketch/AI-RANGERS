/**
 * AI Service — Agent Ranger 2 Phase 1 (Updated)
 *
 * หน้าที่หลัก:
 * 1. buildContextMessage() — inject ข้อมูล brand ครบทุกฟิลด์
 * 2. callClaudeAPI() — call API เท่านั้น
 * 3. ส่งต่อ orchestratorEngine.processAndDeliver() ทำงานต่อทั้งหมด
 *    (Guard loop, saveMessage, extractOutputs, badge)
 *
 * ไม่มี Guard logic ใน aiService อีกต่อไป
 */

import { Agent, getAgentById } from '../data/agents';
import { MasterContext } from '../data/intelligence';
import { orchestratorEngine } from './orchestratorEngine';
import { databaseService, MessageRecord } from './databaseService';

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

export interface SendMessageResponse {
  text: string;
  confidence: number;
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
  confidence: number;
  factCheckResult: { valid: boolean; violations: string[]; warnings: string[] };
  outputs?: Array<{ id: string; type: string; title: string; content: string; agentName: string }>;
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

    const brandIdNum = parseInt(String(ctx.brandId)) || 0;

    // ── บันทึก user message ────────────────────────────────────────────────
    if (brandIdNum > 0) {
      const userMsg: MessageRecord = {
        brandId: brandIdNum,
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
    const contextMsg = this.buildContextMessage(agent, ctx);
    const messages = this.buildMessages(agentId, text, contextMsg, history, attachments);

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
    try {
      rawResponse = await this.callClaudeAPI(agent, messages, contextMsg);
    } catch (err: any) {
      console.error('[AIService] callClaudeAPI failed:', err.message);
      rawResponse = this.buildFallbackResponse(agentId, text, ctx);
    }

    // ── ส่งต่อ Orchestrator ทำงานต่อทั้งหมด ───────────────────────────────
    // (Guard loop, saveMessage agent response, extractOutputs, badge)
    const result = await orchestratorEngine.processAndDeliver({
      agentId,
      agentName: agent.name,
      userInput: text,
      rawResponse,
      context: ctx,
      brandIdNum,
      messages,
      contextMsg,
      callClaudeFn: async (retryMessages, retryContextMsg) => {
        return this.callClaudeAPI(agent, retryMessages, retryContextMsg);
      },
    });

    // ── อัปเดต in-memory history ───────────────────────────────────────────
    const agentHistory = this.chatHistories.get(agentId) || [];
    this.chatHistories.set(agentId, [
      ...agentHistory,
      { role: 'user' as const, content: text },
      { role: 'assistant' as const, content: result.text },
    ].slice(-20));

    return {
      text: result.text,
      confidence: 95,
      outputs: result.outputs,
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
    msg += `\n2. ใช้ข้อมูลแบรนด์ด้านบนทุกครั้ง อย่าสมมติข้อมูลเอง`;
    msg += `\n3. สร้าง output ที่ copy ไปใช้งานได้เลย ไม่ใช่แค่ทฤษฎี`;
    msg += `\n4. ถามทีละ 1-2 คำถาม ไม่ถามทีเดียวหลายข้อ`;
    msg += `\n5. ตอบตรงๆ กระชับ ไม่เกริ่นยาว`;

    return msg;
  }

  // ── buildMessages ─────────────────────────────────────────────────────────
  private buildMessages(
    agentId: string,
    userInput: string,
    contextMsg: string,
    uiHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): Array<{ role: 'user' | 'assistant'; content: any }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

    const imageAttachments = attachments?.filter(a => a.type.startsWith('image/') && a.data) || [];
    const textAttachments = attachments?.filter(a => !a.type.startsWith('image/') && a.data) || [];

    const buildUserContent = (text: string, isFirst = false): any => {
      const base = isFirst ? `${contextMsg}\n\n---\nคำถาม: ${text}` : text;

      if (imageAttachments.length === 0 && textAttachments.length === 0) {
        return base;
      }

      const contentArr: any[] = [{ type: 'text', text: base }];

      imageAttachments.forEach(att => {
        const base64 = att.data?.split(',')[1] || att.data || '';
        const mediaType = att.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
        contentArr.push({
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        });
      });

      textAttachments.forEach(att => {
        const rawText = att.data?.split(',').slice(1).join(',') || '';
        try {
          const decoded = att.type === 'text/plain' ? atob(rawText) : rawText;
          contentArr.push({ type: 'text', text: `\n\n[ไฟล์แนบ: ${att.name}]\n${decoded}` });
        } catch { /* skip */ }
      });

      return contentArr;
    };

    if (uiHistory.length === 0) {
      messages.push({ role: 'user', content: buildUserContent(userInput, true) });
    } else {
      let valid = [...uiHistory];
      if (valid[0]?.role !== 'user') valid = valid.slice(1);
      const trimmed: typeof valid = [];
      for (const m of valid) {
        const last = trimmed[trimmed.length - 1];
        if (!last || last.role !== m.role) trimmed.push(m);
      }
      const sliced = trimmed.slice(-10);
      messages.push(...sliced);
      messages.push({ role: 'user', content: buildUserContent(userInput) });
    }

    return messages;
  }

  // ── callClaudeAPI — call API เท่านั้น ────────────────────────────────────
  async callClaudeAPI(
    agent: Agent,
    messages: Array<{ role: 'user' | 'assistant'; content: any }>,
    contextMsg?: string
  ): Promise<string> {
    const model = (import.meta as any).env?.VITE_CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

    const userApiKey = ((import.meta as any).env?.VITE_ANTHROPIC_API_KEY as string | undefined)
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('socialFactory_anthropicKey') : null);
    const apiUrl = userApiKey
      ? 'https://api.anthropic.com/v1/messages'
      : '/api/anthropic/v1/messages';

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (userApiKey) {
      headers['x-api-key'] = userApiKey;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: contextMsg
            ? `${agent.systemPrompt}\n\n---\n${contextMsg}`
            : agent.systemPrompt,
          messages,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API ${res.status}: ${err}`);
      }

      const data = await res.json() as any;
      return data.content?.find((b: any) => b.type === 'text')?.text || 'ไม่ได้รับคำตอบ';
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

  // ── Fallback ──────────────────────────────────────────────────────────────
  private buildFallbackResponse(agentId: string, input: string, ctx: MasterContext): string {
    const brand = ctx.brandNameTh || 'แบรนด์ของคุณ';
    const usps = Array.isArray(ctx.coreUSP) ? ctx.coreUSP.join(', ') : (ctx.coreUSP || 'คุณภาพดี');

    const templates: Record<string, string> = {
      'brand-builder':    `🏷️ **สร้างแบรนด์สำหรับ ${brand}**\n\nขอถามเพิ่มนิดนึงนะคะ:\n1. ${brand} มีจุดเด่นที่ต่างจากคู่แข่งยังไงคะ?\n2. ลูกค้าหลักเป็นใครคะ?\n\n⚠️ ขณะนี้ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'content-creator':  `✍️ **ไอเดียคอนเทนต์สำหรับ ${brand}**\n\nจุดเด่นที่โพสต์ได้: ${usps}\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'campaign-planner': `📅 **โครงร่างแคมเปญ ${brand}**\n\n- สัปดาห์ 1: แนะนำตัว\n- สัปดาห์ 2: แสดงจุดเด่น\n- สัปดาห์ 3: ปิดการขาย\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'market-insight':   `🔭 **ภาพรวมตลาด**\n\nจุดแข็ง ${brand}: ${usps}\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'advisor':          `💬 ได้รับคำถามแล้วค่ะ: "${input}"\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
    };

    return templates[agentId] || `💬 ได้รับคำถาม: "${input}"\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`;
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
      factCheckResult: { valid: true, violations: [], warnings: [] },
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
