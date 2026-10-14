/**
 * Database Service — เรียกผ่าน serverless API เท่านั้น (api/brands.js)
 *
 * browser ไม่มี connection string ของฐานข้อมูลอีกต่อไป และเห็นได้เฉพาะแบรนด์/ประวัติแชท
 * ที่ผูกกับรหัสเครื่องของตัวเอง (header X-Ranger-User)
 *
 * ถ้า server ไม่มีฐานข้อมูลหรือเรียกไม่สำเร็จ → เก็บใน localStorage ของเครื่องนี้แทน
 * (SWOT / caption / design asset / learning / campaign ยังไม่มี API — เก็บในเครื่องเท่านั้น)
 */

import { getDeviceId } from './deviceId';

export interface BrandRecord {
  /** รหัสแบรนด์ฝั่ง browser (clientId) — server ใช้คู่กับรหัสเครื่องเป็นเจ้าของ */
  id?: number | string;
  // Bucket 1: Strategy
  brandNameEn: string;
  brandNameTh: string;
  industry: string;
  businessModel?: string;
  coreUsp: string | string[];
  competitors?: string[];
  taxId?: string;
  companyAddress?: string;
  // Bucket 2: Creative / Visual
  primaryColor?: string;
  secondaryColor?: string;
  secondaryColors?: string[];
  fontFamily?: string | string[];
  moodKeywords?: string[];
  videoStyle?: string;
  forbiddenElements?: string[];
  logoUrl?: string;
  // Bucket 3: Agency / Communication
  toneOfVoice?: string;
  targetAudience?: string;
  targetPersona?: string;
  painPoints?: string[];
  multilingualLevel?: string;
  forbiddenWords?: string[];
  brandHashtags?: string[];
  automationEmail?: string;
  automationLineOa?: string;
  // Timestamps (returned by Neon, optional in input)
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SwotRecord {
  id?: number;
  brandId: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  marketTrends?: string;
  competitorAnalysis?: string;
  confidence: number;
  generatedBy: string;
}

export interface CaptionRecord {
  id?: number;
  brandId: number;
  caption: string;
  captionTh?: string;
  platform?: string;
  contentType?: string;
  hashtags?: string[];
  engagementTips?: string;
  confidence: number;
  generatedBy: string;
}

export interface DesignAssetRecord {
  id?: number;
  brandId: number;
  assetType: string;
  assetDescription?: string;
  colorScheme?: { primary: string; secondary: string; accent?: string };
  typography?: { fontFamily: string; sizes: Record<string, string> };
  dimensions?: string;
  imageUrl?: string;
  cssCode?: string;
  generatedBy: string;
}

export interface MessageRecord {
  id?: number;
  brandId: number | string;
  role: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  content: string;
  attachments?: Array<{ name: string; type: string; size: number }>;
  confidence?: number;
  validationResults?: Record<string, any>;
  createdAt?: Date;
}

export interface AgentLearningRecord {
  id?: number;
  brandId: number;
  agentId: string;
  agentName: string;
  insight: string;
  insightType: string;
  dataUsed?: string[];
  confidence: number;
  actionable: boolean;
}

export interface CampaignRecord {
  id?: number;
  brandId: number;
  campaignName: string;
  campaignObjective?: string;
  targetAudience?: string;
  platforms?: string[];
  contentCalendar?: Record<string, any>;
  startDate?: Date;
  endDate?: Date;
  status: 'draft' | 'scheduled' | 'active' | 'completed';
  budget?: number;
  estimatedReach?: number;
}

class DatabaseService {
  private readonly localStoragePrefix = 'socialFactory_db_';
  private serverAvailable: boolean | null = null;

  /** true เมื่อเรียก API ฐานข้อมูลสำเร็จครั้งล่าสุด */
  get isReady(): boolean {
    return this.serverAvailable === true;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private lsSet(key: string, value: any) {
    try { localStorage.setItem(`${this.localStoragePrefix}${key}`, JSON.stringify(value)); } catch {}
  }

  private lsGet<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${this.localStoragePrefix}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private lsScan<T>(prefix: string): T[] {
    const out: T[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.localStoragePrefix + prefix)) {
          const data = this.lsGet<T>(key.slice(this.localStoragePrefix.length));
          if (data) out.push(data);
        }
      }
    } catch {}
    return out;
  }

  /** เรียก API — คืน null ถ้า server ไม่มีฐานข้อมูลหรือ error */
  private async api<T>(path: string, init?: { method?: string; body?: any }): Promise<T | null> {
    const deviceId = getDeviceId();
    if (!deviceId || typeof fetch === 'undefined') return null;
    try {
      const res = await fetch(path, {
        method: init?.method || 'GET',
        headers: {
          'X-Ranger-User': deviceId,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });
      if (!res.ok) {
        if (res.status >= 500) this.serverAvailable = false;
        return null;
      }
      this.serverAvailable = true;
      return await res.json();
    } catch {
      this.serverAvailable = false;
      return null;
    }
  }

  // ── brands ────────────────────────────────────────────────────────────────

  async saveBrand(brand: BrandRecord): Promise<BrandRecord> {
    const id = brand.id ?? brand.brandNameTh;
    const data = { ...brand, id, updatedAt: new Date() };
    this.lsSet(`brands_${id}`, data);
    const saved = await this.api<{ brand: BrandRecord }>('/api/brands', { method: 'POST', body: data });
    return saved?.brand ?? data;
  }

  async getBrand(identifier: string | number): Promise<BrandRecord | null> {
    const all = await this.getBrands();
    return all.find(b => String(b.id) === String(identifier) || b.brandNameEn === String(identifier)) ?? null;
  }

  /** แบรนด์ของผู้ใช้คนนี้เท่านั้น */
  async getBrands(): Promise<BrandRecord[]> {
    const res = await this.api<{ brands: BrandRecord[] }>('/api/brands');
    if (res) return res.brands;
    return this.lsScan<BrandRecord>('brands_');
  }

  // ── messages — ไม่เก็บประวัติแชท ──────────────────────────────────────────
  // ระบบไม่บันทึกเนื้อหาแชทที่ไหนเลย (ทั้งฐานข้อมูลและ localStorage) — เก็บแค่สถิติว่าใช้น้องตัวไหน (ฝั่ง server)
  // เมธอดคงไว้เพื่อไม่ให้โค้ดเก่าที่เรียกอยู่พัง

  async saveMessage(message: MessageRecord): Promise<MessageRecord> {
    return { ...message, createdAt: message.createdAt ?? new Date() };
  }

  async getConversationHistory(_brandId: number | string, _limit = 50): Promise<MessageRecord[]> {
    return [];
  }

  // ── เก็บในเครื่องเท่านั้น (ยังไม่มี API) ───────────────────────────────────

  async saveSwotAnalysis(swot: SwotRecord): Promise<SwotRecord> {
    const data = { ...swot, id: Date.now() };
    this.lsSet(`swot_${swot.brandId}_${data.id}`, data);
    return data;
  }

  async saveCaption(caption: CaptionRecord): Promise<CaptionRecord> {
    const data = { ...caption, id: Date.now() };
    this.lsSet(`caption_${caption.brandId}_${data.id}`, data);
    return data;
  }

  async saveDesignAsset(asset: DesignAssetRecord): Promise<DesignAssetRecord> {
    const data = { ...asset, id: Date.now() };
    this.lsSet(`design_${asset.brandId}_${data.id}`, data);
    return data;
  }

  async saveAgentLearning(learning: AgentLearningRecord): Promise<AgentLearningRecord> {
    const data = { ...learning, id: Date.now() };
    this.lsSet(`learning_${learning.brandId}_${data.id}`, data);
    return data;
  }

  async saveCampaign(campaign: CampaignRecord): Promise<CampaignRecord> {
    const data = { ...campaign, id: Date.now() };
    this.lsSet(`campaign_${campaign.brandId}_${data.id}`, data);
    return data;
  }

  // ── status ────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      isReady: this.isReady,
      backend: this.isReady ? 'Neon PostgreSQL (ผ่าน /api)' : 'localStorage (fallback)',
      message: this.isReady
        ? '✅ Connected to database via server API'
        : '⚠️  Database API not confirmed yet — using localStorage until it responds',
    };
  }

  clearLocalStorage() {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.localStoragePrefix)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    console.log(`[DB] Cleared ${keys.length} localStorage items`);
  }
}

export const databaseService = new DatabaseService();
export default databaseService;
