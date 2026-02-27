import { db } from '../db/client';
import { brands, messages, swotAnalyses, captions, designAssets, agentLearnings, campaignSchedules } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Database Service — Neon PostgreSQL via @neondatabase/serverless HTTP driver
 * Falls back to localStorage when DATABASE_URL is not set
 */

export interface BrandRecord {
  id?: number;
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
  brandId: number;
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

  /** True only if @neondatabase/serverless client was initialised */
  get isReady(): boolean {
    return db !== null;
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

  // ── saveBrand ─────────────────────────────────────────────────────────────

  async saveBrand(brand: BrandRecord): Promise<BrandRecord> {
    if (db) {
      try {
        const coreUspArr = Array.isArray(brand.coreUsp)
          ? brand.coreUsp
          : brand.coreUsp ? [brand.coreUsp] : [];
        const fontFamilyArr = Array.isArray(brand.fontFamily)
          ? brand.fontFamily
          : brand.fontFamily ? [brand.fontFamily] : [];
        const [row] = await db.insert(brands).values({
          brandNameEn: brand.brandNameEn,
          brandNameTh: brand.brandNameTh,
          industry: brand.industry,
          businessModel: brand.businessModel,
          coreUsp: coreUspArr,
          competitors: brand.competitors ?? [],
          taxId: brand.taxId,
          companyAddress: brand.companyAddress,
          targetAudience: brand.targetAudience,
          primaryColor: brand.primaryColor,
          secondaryColors: brand.secondaryColors ?? [],
          fontFamily: fontFamilyArr,
          moodKeywords: brand.moodKeywords ?? [],
          videoStyle: brand.videoStyle,
          forbiddenElements: brand.forbiddenElements ?? [],
          logoUrl: brand.logoUrl,
          toneOfVoice: brand.toneOfVoice,
          targetPersona: brand.targetPersona,
          painPoints: brand.painPoints ?? [],
          multilingualLevel: brand.multilingualLevel,
          forbiddenWords: brand.forbiddenWords ?? [],
          brandHashtags: brand.brandHashtags ?? [],
          automationEmail: brand.automationEmail,
          automationLineOa: brand.automationLineOa,
          updatedAt: new Date(),
        }).returning();
        return { ...brand, id: row.id };
      } catch (err) {
        console.warn('[DB] saveBrand failed, using localStorage:', err);
      }
    }
    const data = { ...brand, id: 1, createdAt: new Date(), updatedAt: new Date() };
    this.lsSet(`brands_${brand.brandNameEn}`, data);
    return data;
  }

  // ── getBrand ──────────────────────────────────────────────────────────────

  async getBrand(identifier: string | number): Promise<BrandRecord | null> {
    if (db) {
      try {
        const rows = typeof identifier === 'number'
          ? await db.select().from(brands).where(eq(brands.id, identifier)).limit(1)
          : await db.select().from(brands).where(eq(brands.brandNameEn, String(identifier))).limit(1);
        if (rows.length > 0) {
          const r = rows[0];
          // คืน fields ครบทุก field ที่มีใน schema (ตรงกับ getBrands)
          return {
            id: r.id,
            brandNameEn: r.brandNameEn,
            brandNameTh: r.brandNameTh,
            industry: r.industry,
            businessModel: r.businessModel ?? undefined,
            coreUsp: Array.isArray(r.coreUsp) ? r.coreUsp as string[] : [String(r.coreUsp ?? '')].filter(Boolean),
            competitors: Array.isArray(r.competitors) ? r.competitors as string[] : [],
            taxId: r.taxId ?? undefined,
            companyAddress: r.companyAddress ?? undefined,
            primaryColor: r.primaryColor ?? undefined,
            secondaryColors: Array.isArray(r.secondaryColors) ? r.secondaryColors as string[] : [],
            fontFamily: r.fontFamily as string | undefined,
            moodKeywords: Array.isArray(r.moodKeywords) ? r.moodKeywords as string[] : [],
            videoStyle: r.videoStyle ?? undefined,
            forbiddenElements: Array.isArray(r.forbiddenElements) ? r.forbiddenElements as string[] : [],
            logoUrl: r.logoUrl ?? undefined,
            toneOfVoice: r.toneOfVoice ?? undefined,
            targetAudience: r.targetAudience ?? undefined,
            targetPersona: r.targetPersona ?? undefined,
            painPoints: Array.isArray(r.painPoints) ? r.painPoints as string[] : [],
            multilingualLevel: r.multilingualLevel ?? undefined,
            forbiddenWords: Array.isArray(r.forbiddenWords) ? r.forbiddenWords as string[] : [],
            brandHashtags: Array.isArray(r.brandHashtags) ? r.brandHashtags as string[] : [],
            automationEmail: r.automationEmail ?? undefined,
            automationLineOa: r.automationLineOa ?? undefined,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        }
        return null;
      } catch (err) {
        console.warn('[DB] getBrand failed:', err);
      }
    }
    return this.lsGet<BrandRecord>(`brands_${identifier}`);
  }

  // ── getBrands ─────────────────────────────────────────────────────────────
  // คืน brand ทั้งหมด (App.jsx ใช้ load context จาก Neon ครั้งแรก)

  async getBrands(): Promise<BrandRecord[]> {
    if (db) {
      try {
        const rows = await db.select().from(brands).orderBy(desc(brands.createdAt)).limit(10);
        return rows.map(r => ({
          id: r.id,
          brandNameEn: r.brandNameEn,
          brandNameTh: r.brandNameTh,
          industry: r.industry,
          businessModel: r.businessModel ?? undefined,
          coreUsp: Array.isArray(r.coreUsp) ? r.coreUsp as string[] : [String(r.coreUsp ?? '')].filter(Boolean),
          competitors: Array.isArray(r.competitors) ? r.competitors as string[] : [],
          primaryColor: r.primaryColor ?? undefined,
          secondaryColors: Array.isArray(r.secondaryColors) ? r.secondaryColors as string[] : [],
          fontFamily: r.fontFamily as string | undefined,
          moodKeywords: Array.isArray(r.moodKeywords) ? r.moodKeywords as string[] : [],
          videoStyle: r.videoStyle ?? undefined,
          forbiddenElements: Array.isArray(r.forbiddenElements) ? r.forbiddenElements as string[] : [],
          logoUrl: r.logoUrl ?? undefined,
          toneOfVoice: r.toneOfVoice ?? undefined,
          targetAudience: r.targetAudience ?? undefined,
          targetPersona: r.targetPersona ?? undefined,
          painPoints: Array.isArray(r.painPoints) ? r.painPoints as string[] : [],
          forbiddenWords: Array.isArray(r.forbiddenWords) ? r.forbiddenWords as string[] : [],
          brandHashtags: Array.isArray(r.brandHashtags) ? r.brandHashtags as string[] : [],
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
      } catch (err) {
        console.warn('[DB] getBrands failed:', err);
      }
    }
    // localStorage fallback: scan for saved brands
    const result: BrandRecord[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.localStoragePrefix + 'brands_')) {
        const data = this.lsGet<BrandRecord>(key.replace(this.localStoragePrefix, ''));
        if (data) result.push(data);
      }
    }
    return result;
  }

    // ── saveMessage ───────────────────────────────────────────────────────────

  async saveMessage(message: MessageRecord): Promise<MessageRecord> {
    if (db) {
      try {
        const [row] = await db.insert(messages).values({
          brandId: message.brandId,
          role: message.role,
          agentId: message.agentId,
          agentName: message.agentName,
          content: message.content,
          attachments: message.attachments ?? [],
          confidence: message.confidence,
          validationResults: message.validationResults ?? {},
        }).returning();
        return { ...message, id: row.id, createdAt: row.createdAt };
      } catch (err) {
        console.warn('[DB] saveMessage failed, using localStorage:', err);
      }
    }
    const data = { ...message, id: Date.now(), createdAt: new Date() };
    this.lsSet(`message_${message.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── getConversationHistory ────────────────────────────────────────────────

  async getConversationHistory(brandId: number | string, limit = 50): Promise<MessageRecord[]> {
    const bid = typeof brandId === 'number' ? brandId : parseInt(String(brandId)) || 0;
    if (db && bid > 0) {
      try {
        const rows = await db.select().from(messages)
          .where(eq(messages.brandId, bid))
          .orderBy(desc(messages.createdAt))
          .limit(limit);
        return rows.reverse().map(r => ({
          id: r.id,
          brandId: r.brandId,
          role: r.role as 'user' | 'agent',
          agentId: r.agentId ?? undefined,
          agentName: r.agentName ?? undefined,
          content: r.content,
          confidence: r.confidence ?? undefined,
          createdAt: r.createdAt,
        }));
      } catch (err) {
        console.warn('[DB] getConversationHistory failed:', err);
      }
    }
    // localStorage fallback
    const msgs: MessageRecord[] = [];
    const prefix = `${this.localStoragePrefix}message_${String(brandId)}`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try { const d = localStorage.getItem(key); if (d) msgs.push(JSON.parse(d)); } catch {}
      }
    }
    return msgs
      .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
      .slice(-limit);
  }

  // ── saveSwotAnalysis ──────────────────────────────────────────────────────

  async saveSwotAnalysis(swot: SwotRecord): Promise<SwotRecord> {
    if (db) {
      try {
        const [row] = await db.insert(swotAnalyses).values({
          brandId: swot.brandId,
          strengths: swot.strengths,
          weaknesses: swot.weaknesses,
          opportunities: swot.opportunities,
          threats: swot.threats,
          marketTrends: swot.marketTrends,
          competitorAnalysis: swot.competitorAnalysis,
          confidence: swot.confidence,
          generatedBy: swot.generatedBy,
          updatedAt: new Date(),
        }).returning();
        return { ...swot, id: row.id };
      } catch (err) {
        console.warn('[DB] saveSwotAnalysis failed:', err);
      }
    }
    const data = { ...swot, id: Date.now() };
    this.lsSet(`swot_${swot.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── saveCaption ───────────────────────────────────────────────────────────

  async saveCaption(caption: CaptionRecord): Promise<CaptionRecord> {
    if (db) {
      try {
        const [row] = await db.insert(captions).values({
          brandId: caption.brandId,
          caption: caption.caption,
          captionTh: caption.captionTh,
          platform: caption.platform,
          contentType: caption.contentType,
          hashtags: caption.hashtags ?? [],
          engagementTips: caption.engagementTips,
          confidence: caption.confidence,
          generatedBy: caption.generatedBy,
          updatedAt: new Date(),
        }).returning();
        return { ...caption, id: row.id };
      } catch (err) {
        console.warn('[DB] saveCaption failed:', err);
      }
    }
    const data = { ...caption, id: Date.now() };
    this.lsSet(`caption_${caption.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── saveDesignAsset ───────────────────────────────────────────────────────

  async saveDesignAsset(asset: DesignAssetRecord): Promise<DesignAssetRecord> {
    if (db) {
      try {
        const [row] = await db.insert(designAssets).values({
          brandId: asset.brandId,
          assetType: asset.assetType,
          assetDescription: asset.assetDescription,
          colorScheme: asset.colorScheme ?? {},
          typography: asset.typography ?? {},
          dimensions: asset.dimensions,
          imageUrl: asset.imageUrl,
          cssCode: asset.cssCode,
          generatedBy: asset.generatedBy,
          updatedAt: new Date(),
        }).returning();
        return { ...asset, id: row.id };
      } catch (err) {
        console.warn('[DB] saveDesignAsset failed:', err);
      }
    }
    const data = { ...asset, id: Date.now() };
    this.lsSet(`design_${asset.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── saveAgentLearning ─────────────────────────────────────────────────────

  async saveAgentLearning(learning: AgentLearningRecord): Promise<AgentLearningRecord> {
    if (db) {
      try {
        const [row] = await db.insert(agentLearnings).values({
          brandId: learning.brandId,
          agentId: learning.agentId,
          agentName: learning.agentName,
          insight: learning.insight,
          insightType: learning.insightType,
          dataUsed: learning.dataUsed ?? [],
          confidence: learning.confidence,
          actionable: learning.actionable,
        }).returning();
        return { ...learning, id: row.id };
      } catch (err) {
        console.warn('[DB] saveAgentLearning failed:', err);
      }
    }
    const data = { ...learning, id: Date.now() };
    this.lsSet(`learning_${learning.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── saveCampaign ──────────────────────────────────────────────────────────

  async saveCampaign(campaign: CampaignRecord): Promise<CampaignRecord> {
    if (db) {
      try {
        const [row] = await db.insert(campaignSchedules).values({
          brandId: campaign.brandId,
          campaignName: campaign.campaignName,
          campaignObjective: campaign.campaignObjective,
          targetAudience: campaign.targetAudience,
          platforms: campaign.platforms ?? [],
          contentCalendar: campaign.contentCalendar ?? {},
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          status: campaign.status,
          budget: campaign.budget,
          estimatedReach: campaign.estimatedReach,
          updatedAt: new Date(),
        }).returning();
        return { ...campaign, id: row.id };
      } catch (err) {
        console.warn('[DB] saveCampaign failed:', err);
      }
    }
    const data = { ...campaign, id: Date.now() };
    this.lsSet(`campaign_${campaign.brandId}_${Date.now()}`, data);
    return data;
  }

  // ── status ────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      isReady: this.isReady,
      backend: this.isReady ? 'Neon PostgreSQL (HTTP)' : 'localStorage (fallback)',
      message: this.isReady
        ? '✅ Connected to Neon PostgreSQL'
        : '⚠️  Using localStorage — set VITE_DATABASE_URL in .env to enable Neon',
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
