/**
 * AI Service — Agent Ranger 2 Phase 1
 * 
 * Public API:
 *   aiService.sendMessage(rangerId, text, history, ctx, attachments) → { text, confidence, outputs }
 *   aiService.initialize(context)
 *   aiService.clearHistory()
 *   aiService.clearAgentHistory(agentId)
 * 
 * Ranger ID → Agent ID mapping (UI ใหม่ ↔ backend agents.ts):
 *   'brand'    → 'brand-builder'
 *   'content'  → 'content-creator'
 *   'planning' → 'campaign-planner'
 *   'marketing'→ 'market-insight'
 *   'consult'  → 'advisor'
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
  // pass-through (ถ้าส่ง agent ID มาตรงๆ ก็ใช้ได้)
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

class AIService {
  private masterContext: MasterContext | null = null;
  // Per-agent conversation history for multi-turn context (kept in memory)
  private chatHistories: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();

  // ── initialize ────────────────────────────────────────────────────────────
  initialize(context: MasterContext): void {
    this.masterContext = context;
    orchestratorEngine.setMasterContext(context);
  }

  // ── sendMessage (PRIMARY PUBLIC API used by UI-002 Workspace) ─────────────
  async sendMessage(
    rangerId: string,
    text: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    context?: MasterContext,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): Promise<SendMessageResponse> {

    // 1. Update context
    if (context) this.initialize(context);
    const ctx = this.masterContext || this.buildDefaultContext();

    // 2. Resolve agentId
    const agentId = RANGER_TO_AGENT[rangerId] || 'advisor';
    const agent = getAgentById(agentId);
    if (!agent) throw new Error(`ไม่พบ Ranger: ${rangerId}`);

    // 3. Persist user message (non-blocking)
    const brandIdNum = parseInt(String(ctx.brandId)) || 0;
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
      databaseService.saveMessage(userMsg).catch(() => {}); // fire-and-forget
    }

    // 4. Build context string (rich — ใช้ข้อมูลจาก Neon ทุก field)
    const contextMsg = this.buildContextMessage(agent, ctx);

    // 5. Build API messages (ส่ง attachments ไปด้วยเพื่อ vision support)
    const messages = this.buildMessages(agentId, text, contextMsg, history, attachments);

    // 6. Route → Call Claude API → Validate (Orchestrator fully integrated)
    let responseText: string;
    try {
      // 6a. Log Orchestrator routing decision (ไม่ override user selection)
      const routingResult = orchestratorEngine.route(text);
      if (routingResult.primaryAgent && routingResult.primaryAgent !== agentId) {
        console.info(`[Orchestrator] Routing suggests '${routingResult.primaryAgent}' but user selected '${agentId}' — respecting user choice`);
      }

      // 6b. Call Claude API with full brand context + vision content
      responseText = await this.callClaudeAPI(agent, messages, contextMsg);

      // 6c. Validate output quality through Orchestrator
      const validation = orchestratorEngine.validate(agentId, responseText);
      if (!validation.passed) {
        const criticals = validation.issues.filter(i => i.severity === 'critical');
        if (criticals.length > 0) {
          console.warn(`[Orchestrator] Critical validation failed for '${agentId}':`, criticals.map(i => i.message));
          // ถ้า output ว่างเปล่าหรือไม่มีเนื้อหา → ใช้ fallback
          if (criticals.some(i => i.message.includes('ว่างเปล่า'))) {
            responseText = this.buildFallbackResponse(agentId, text, ctx);
          }
        } else {
          console.info(`[Orchestrator] Validation warnings for '${agentId}':`, validation.issues.map(i => i.message));
        }
      }
    } catch (err: any) {
      // Graceful fallback
      console.error('[AIService] API error:', err.message);
      responseText = this.buildFallbackResponse(agentId, text, ctx);
    }

    // 7. Update in-memory history
    const agentHistory = this.chatHistories.get(agentId) || [];
    this.chatHistories.set(agentId, [
      ...agentHistory,
      { role: 'user', content: text },
      { role: 'assistant', content: responseText },
    ].slice(-20));

    // 8. Persist agent response (non-blocking)
    if (brandIdNum > 0) {
      const agentMsg: MessageRecord = {
        brandId: brandIdNum,
        role: 'agent',
        agentId,
        agentName: agent.name,
        content: responseText,
        createdAt: new Date(),
      };
      databaseService.saveMessage(agentMsg).catch(() => {});
    }

    // 9. Extract outputs (documents/code the agent created)
    const outputs = this.extractOutputs(responseText, agent.name);

    return {
      text: responseText,
      confidence: 95,
      outputs,
    };
  }

  // ── buildContextMessage — ส่งข้อมูล Neon ครบทุก field ให้ Agent ──────────
  private buildContextMessage(agent: Agent, ctx: MasterContext): string {
    const hasRealData = !ctx.isDefault && ctx.brandNameTh && ctx.brandNameTh !== 'ลูกค้าทั่วไป';
    const usps = Array.isArray(ctx.coreUSP) ? ctx.coreUSP : [ctx.coreUSP];

    let msg = `## ข้อมูลธุรกิจของผู้ใช้`;
    msg += `\n- ชื่อแบรนด์: ${ctx.brandNameTh}${ctx.brandNameEn ? ` (${ctx.brandNameEn})` : ''}`;
    msg += `\n- ประเภทธุรกิจ: ${ctx.industry || 'ไม่ระบุ'}`;
    msg += `\n- รูปแบบธุรกิจ: ${ctx.businessModel || 'ไม่ระบุ'}`;
    msg += `\n- จุดเด่น (USP): ${usps.filter(Boolean).join(' | ') || 'ยังไม่ระบุ'}`;
    msg += `\n- กลุ่มลูกค้าหลัก: ${ctx.targetAudience || 'ยังไม่ระบุ'}`;

    if (ctx.targetPersona) {
      msg += `\n- Persona ลูกค้า: ${ctx.targetPersona}`;
    }

    if (ctx.painPoints?.length) {
      msg += `\n- ปัญหาที่ลูกค้าเจอ: ${ctx.painPoints.join(', ')}`;
    }

    msg += `\n- โทนเสียงแบรนด์: ${ctx.toneOfVoice || 'professional'}`;

    if (ctx.visualStyle?.primaryColor) {
      msg += `\n- สีแบรนด์หลัก: ${ctx.visualStyle.primaryColor}`;
    }
    if (ctx.visualStyle?.secondaryColors?.length) {
      msg += `\n- สีรอง: ${ctx.visualStyle.secondaryColors.join(', ')}`;
    }
    if (ctx.visualStyle?.fontFamily?.length) {
      msg += `\n- ฟอนต์: ${ctx.visualStyle.fontFamily.join(', ')}`;
    }
    if (ctx.visualStyle?.moodKeywords?.length) {
      msg += `\n- Mood & Feel: ${ctx.visualStyle.moodKeywords.join(', ')}`;
    }
    if (ctx.visualStyle?.videoStyle) {
      msg += `\n- สไตล์วิดีโอ: ${ctx.visualStyle.videoStyle}`;
    }
    if (ctx.visualStyle?.forbiddenElements?.length) {
      msg += `\n- ห้ามใช้ visual: ${ctx.visualStyle.forbiddenElements.join(', ')}`;
    }

    if (ctx.competitors?.length) {
      msg += `\n- คู่แข่งที่รู้จัก: ${ctx.competitors.join(', ')}`;
    }

    if (ctx.forbiddenWords?.length) {
      msg += `\n- คำที่ห้ามใช้: ${ctx.forbiddenWords.join(', ')}`;
    }

    if (ctx.brandHashtags?.length) {
      msg += `\n- แฮชแท็กประจำแบรนด์: ${ctx.brandHashtags.join(' ')}`;
    }

    if (ctx.multilingualLevel) {
      msg += `\n- ระดับภาษา: ${ctx.multilingualLevel}`;
    }

    if (ctx.logoUrl) {
      msg += `\n- Logo URL: ${ctx.logoUrl}`;
    }

    if (!hasRealData) {
      msg += `\n\n⚠️ ผู้ใช้ยังไม่ได้กรอกข้อมูลแบรนด์ครบ — ถ้าต้องใช้ข้อมูลเฉพาะ ให้ถามก่อน 1-2 คำถามสั้นๆ`;
    }

    msg += `\n\n## กฎการตอบ
1. ตอบภาษาไทยเสมอ ใช้คำ English เฉพาะที่คนทั่วไปรู้จัก
2. ใช้ข้อมูลแบรนด์ด้านบนทุกครั้ง อย่าสมมติข้อมูลเอง
3. สร้าง output ที่ copy ไปใช้งานได้เลย ไม่ใช่แค่ทฤษฎี
4. ถามทีละ 1-2 คำถาม ไม่ถามทีเดียวหลายข้อ
5. ตอบตรงๆ กระชับ ไม่เกริ่นยาว`;

    return msg;
  }

  // ── buildMessages ─────────────────────────────────────────────────────────
  // รองรับ vision: ถ้ามี image attachments จะ embed เป็น content array
  private buildMessages(
    agentId: string,
    userInput: string,
    contextMsg: string,
    uiHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    attachments?: Array<{ name: string; type: string; size: number; data?: string }>
  ): Array<{ role: 'user' | 'assistant'; content: any }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

    // Build vision content สำหรับ images ที่แนบมา
    const imageAttachments = attachments?.filter(a => a.type.startsWith('image/') && a.data) || [];
    const textAttachments = attachments?.filter(a => !a.type.startsWith('image/') && a.data) || [];

    // สร้าง content array สำหรับ user message ปัจจุบัน
    const buildUserContent = (text: string, isFirst = false): any => {
      const base = isFirst ? `${contextMsg}\n\n---\nคำถาม: ${text}` : text;

      // ถ้าไม่มี attachment → ส่งเป็น string ธรรมดา
      if (imageAttachments.length === 0 && textAttachments.length === 0) {
        return base;
      }

      // มี attachments → ส่งเป็น content array (Claude Vision format)
      const contentArr: any[] = [{ type: 'text', text: base }];

      imageAttachments.forEach(att => {
        // base64 data URI: "data:image/jpeg;base64,xxxx" → ตัด prefix ออก
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
        } catch { /* skip if decode fails */ }
      });

      return contentArr;
    };

    if (uiHistory.length === 0) {
      // รอบแรก: inject context + attachments
      messages.push({ role: 'user', content: buildUserContent(userInput, true) });
    } else {
      // รอบต่อไป: ส่ง history + user message ใหม่
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

  // ── callClaudeAPI ─────────────────────────────────────────────────────────
  private async callClaudeAPI(
    agent: Agent,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    contextMsg?: string
  ): Promise<string> {
    const model = (import.meta as any).env?.VITE_CLAUDE_MODEL
      || (import.meta as any).env?.['VITE_CLAUDE_MODEL']
      || 'claude-haiku-4-5-20251001';

    const userApiKey = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)
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
          // ✅ รวม brand context เข้ากับ system prompt เสมอ
          // ทำให้ Agent รู้ข้อมูลแบรนด์ทุก turn ไม่ใช่แค่รอบแรก
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

  // ── extractOutputs ────────────────────────────────────────────────────────
  private extractOutputs(text: string, agentName: string) {
    const outputs: Array<{ id: string; type: string; title: string; content: string; agentName: string }> = [];
    // ถ้าตอบยาวกว่า 400 chars และมี structure ชัดเจน → ถือว่าเป็น document
    if (text.length > 400 && (text.includes('##') || text.includes('```') || text.includes('1.'))) {
      outputs.push({
        id: `out_${Date.now()}`,
        type: 'document',
        title: `ผลงานจาก${agentName}`,
        content: text,
        agentName,
      });
    }
    return outputs;
  }

  // ── Fallback (ใช้ตอน API ไม่ตอบ) ─────────────────────────────────────────
  private buildFallbackResponse(agentId: string, input: string, ctx: MasterContext): string {
    const brand = ctx.brandNameTh || 'แบรนด์ของคุณ';
    const industry = ctx.industry || 'ธุรกิจ';
    const usps = Array.isArray(ctx.coreUSP) ? ctx.coreUSP.join(', ') : (ctx.coreUSP || 'คุณภาพดี');
    const audience = ctx.targetAudience || 'กลุ่มเป้าหมาย';

    const templates: Record<string, string> = {
      'brand-builder': `🏷️ **สร้างแบรนด์สำหรับ ${brand}**\n\nจากที่บอกมา ขอถามเพิ่มนิดนึงนะคะ:\n1. ${brand} มีจุดเด่นที่ต่างจากคู่แข่งยังไงคะ?\n2. ลูกค้าหลักเป็นใครคะ? อายุเท่าไหร่? อยู่ไหน?\n\n⚠️ ขณะนี้ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'content-creator': `✍️ **ไอเดียคอนเทนต์สำหรับ ${brand}**\n\n**Hook ที่ใช้ได้:**\n"[ปัญหาที่ ${audience} เจอ] — ${brand} มีคำตอบ"\n\n**จุดเด่นที่โพสต์ได้:** ${usps}\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'campaign-planner': `📅 **โครงร่างแคมเปญ ${brand}**\n\n- สัปดาห์ 1: แนะนำตัว ให้คนรู้จัก\n- สัปดาห์ 2: แสดงจุดเด่น "${usps}"\n- สัปดาห์ 3: ปิดการขาย / CTA\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'market-insight': `🔭 **ภาพรวมตลาด ${industry}**\n\n- วิเคราะห์คู่แข่ง: ${ctx.competitors?.join(', ') || 'ยังไม่มีข้อมูล'}\n- โอกาส: ช่องว่างที่คู่แข่งยังไม่ได้ทำ\n- จุดแข็ง ${brand}: ${usps}\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
      'advisor': `💬 ได้รับคำถามแล้วค่ะ: "${input}"\n\nฉันพร้อมช่วยทันทีที่ระบบกลับมาออนไลน์นะคะ\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`,
    };

    return templates[agentId] || `💬 ได้รับคำถาม: "${input}"\n\n⚠️ ระบบออฟไลน์ชั่วคราว กรุณาตรวจสอบ API Key`;
  }

  // ── Public helpers ────────────────────────────────────────────────────────
  clearHistory(): void {
    this.chatHistories.clear();
  }

  clearAgentHistory(agentId: string): void {
    // รองรับทั้ง ranger ID และ agent ID
    const resolvedId = RANGER_TO_AGENT[agentId] || agentId;
    this.chatHistories.delete(resolvedId);
  }
}

export const aiService = new AIService();
