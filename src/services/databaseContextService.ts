/**
 * Database Context Service - Bridge between Agents and Database
 * Provides brand context/knowledge to agents for intelligent decision-making
 *
 * This service:
 * 1. Retrieves full brand knowledge from database
 * 2. Filters context by agent cluster (Smart Lazy Distribution)
 * 3. Enriches agent responses with database context
 * 4. Records agent learnings back to database
 */

import { MasterContext } from '../data/intelligence';
import { databaseService, BrandRecord, AgentLearningRecord } from './databaseService';

/**
 * Agent-Specific Context Types
 * Each agent cluster gets only relevant data
 */

export interface StrategistContext {
  // Bucket 1: Market & Business
  brandId?: number;
  coreUSP?: string[];
  businessModel?: string;
  competitors?: string[];
  industry?: string;
  // Useful cross-data
  targetAudience?: string;
  toneOfVoice?: string;
}

export interface CreativeContext {
  // Bucket 2: Visual Identity
  brandId?: number;
  primaryColor?: string;
  secondaryColors?: string[];
  fontFamily?: string[];
  moodKeywords?: string[];
  videoStyle?: string;
  forbiddenElements?: string[];
  // Useful cross-data
  brandNameTh?: string;
  coreUSP?: string[];
  toneOfVoice?: string;
}

export interface AgencyContext {
  // Bucket 3: Communication & Sales
  brandId?: number;
  toneOfVoice?: string;
  targetAudience?: string;
  targetPersona?: string;
  painPoints?: string[];
  forbiddenWords?: string[];
  multilingualLevel?: string;
  automationLineOa?: string;
  automationEmail?: string;
  // Useful cross-data
  brandHashtags?: string[];
  coreUSP?: string[];
}

export interface CompleteAgentContext {
  strategist?: StrategistContext;
  creative?: CreativeContext;
  agency?: AgencyContext;
  timestamp: string;
  brandId?: number;
}

class DatabaseContextService {
  private brandCache: Map<number | string, BrandRecord | null> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Get agent context based on cluster type
   * Smart Lazy Distribution: Send only relevant data
   */
  async getAgentContextByCluster(
    brandId: number | string,
    cluster: string
  ): Promise<StrategistContext | CreativeContext | AgencyContext | null> {
    try {
      const brand = await this.getBrandContext(brandId);

      if (!brand) {
        console.warn(`[DatabaseContext] Brand not found: ${brandId}`);
        return null;
      }

      switch (cluster) {
        // Phase 1 cluster names
        case 'brand':       // น้องแบรนด์
          return this.buildStrategistContext(brand);
        case 'content':     // น้องคอนเทนต์, น้องแพลน
          return this.buildAgencyContext(brand);   // communication data
        case 'growth':      // น้องดูตลาด, น้องที่ปรึกษา
          return this.buildStrategistContext(brand); // strategy + market data
        // Legacy aliases (backward compat)
        case 'strategy':
          return this.buildStrategistContext(brand);
        case 'creative':
          return this.buildCreativeContext(brand);
        default:
          // ไม่รู้จัก cluster → ส่ง base context ทั้งหมด ไม่ return null
          return this.buildStrategistContext(brand);
      }
    } catch (error) {
      console.error(`[DatabaseContext] Error getting agent context:`, error);
      return null;
    }
  }

  /**
   * Get complete context for all clusters
   * Used when agent needs cross-cluster data
   */
  async getCompleteAgentContext(brandId: number | string): Promise<CompleteAgentContext | null> {
    try {
      const brand = await this.getBrandContext(brandId);

      if (!brand) return null;

      return {
        strategist: this.buildStrategistContext(brand),
        creative: this.buildCreativeContext(brand),
        agency: this.buildAgencyContext(brand),
        brandId: typeof brandId === 'string' ? parseInt(brandId) : brandId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[DatabaseContext] Error getting complete context:`, error);
      return null;
    }
  }

  /**
   * Get brand context with caching
   */
  private async getBrandContext(identifier: number | string): Promise<BrandRecord | null> {
    // Check cache
    if (this.brandCache.has(identifier)) {
      const cached = this.brandCache.get(identifier);
      if (cached !== null) {
        return cached;
      }
    }

    try {
      const brand = await databaseService.getBrand(identifier);
      this.brandCache.set(identifier, brand);
      return brand;
    } catch (error) {
      console.error(`[DatabaseContext] Error fetching brand:`, error);
      this.brandCache.set(identifier, null);
      return null;
    }
  }

  /**
   * Clear brand cache
   */
  clearBrandCache(brandId?: number | string): void {
    if (brandId) {
      this.brandCache.delete(brandId);
    } else {
      this.brandCache.clear();
    }
  }

  /**
   * Build context for Strategist Cluster
   * (Market Analyst, Business Planner, Insights Agent)
   */
  private buildStrategistContext(brand: BrandRecord): StrategistContext {
    return {
      brandId: brand.id,
      coreUSP: Array.isArray(brand.coreUsp)
        ? brand.coreUsp as unknown as string[]
        : [brand.coreUsp as unknown as string],
      businessModel: brand.businessModel as unknown as string || undefined,
      competitors: brand.competitors as unknown as string[] || undefined,
      industry: brand.industry,
      targetAudience: brand.targetAudience as unknown as string || undefined,
      toneOfVoice: brand.toneOfVoice,
    };
  }

  /**
   * Build context for Creative Cluster
   * (Brand Builder, Design Agent, Video Generator - Art)
   */
  private buildCreativeContext(brand: BrandRecord): CreativeContext {
    return {
      brandId: brand.id,
      primaryColor: brand.primaryColor as unknown as string || undefined,
      secondaryColors: brand.secondaryColors as unknown as string[] || undefined,
      fontFamily: brand.fontFamily as unknown as string[] || undefined,
      moodKeywords: brand.moodKeywords as unknown as string[] || undefined,
      videoStyle: brand.videoStyle as unknown as string || undefined,
      forbiddenElements: brand.forbiddenElements as unknown as string[] || undefined,
      brandNameTh: brand.brandNameTh,
      coreUSP: Array.isArray(brand.coreUsp)
        ? brand.coreUsp as unknown as string[]
        : [brand.coreUsp as unknown as string],
      toneOfVoice: brand.toneOfVoice,
    };
  }

  /**
   * Build context for Agency Cluster
   * (Caption Creator, Campaign Planner, Video Generator - Script, Automation Specialist)
   */
  private buildAgencyContext(brand: BrandRecord): AgencyContext {
    return {
      brandId: brand.id,
      toneOfVoice: brand.toneOfVoice,
      targetAudience: brand.targetAudience as unknown as string || undefined,
      targetPersona: brand.targetPersona as unknown as string || undefined,
      painPoints: brand.painPoints as unknown as string[] || undefined,
      forbiddenWords: brand.forbiddenWords as unknown as string[] || undefined,
      multilingualLevel: brand.multilingualLevel as unknown as string || undefined,
      automationLineOa: brand.automationLineOa as unknown as string || undefined,
      automationEmail: brand.automationEmail as unknown as string || undefined,
      brandHashtags: brand.brandHashtags as unknown as string[] || undefined,
      coreUSP: Array.isArray(brand.coreUsp)
        ? brand.coreUsp as unknown as string[]
        : [brand.coreUsp as unknown as string],
    };
  }

  /**
   * Save agent learning/insight to database
   * Called after agent generates response
   */
  async recordAgentLearning(
    brandId: number | string,
    agentId: string,
    agentName: string,
    insight: string,
    dataUsed?: string[],
    confidence?: number,
    insightType?: string
  ): Promise<void> {
    try {
      const learning: AgentLearningRecord = {
        brandId: typeof brandId === 'string' ? parseInt(brandId) : brandId,
        agentId,
        agentName,
        insight,
        insightType: insightType || 'General',
        dataUsed: dataUsed || [],
        confidence: confidence || 75,
        actionable: confidence ? confidence >= 70 : false
      };

      await databaseService.saveAgentLearning(learning);
      console.log(`[DatabaseContext] Learning recorded for ${agentName}`);
    } catch (error) {
      console.warn(`[DatabaseContext] Failed to record learning (non-blocking):`, error);
    }
  }

  /**
   * Analyze which brand fields an agent used
   * Helps track data dependency
   */
  getFieldsUsedByAgent(
    agentId: string,
    context: StrategistContext | CreativeContext | AgencyContext | null
  ): string[] {
    if (!context) return [];

    const usedFields: string[] = [];
    const contextObj = context as Record<string, any>;

    // Check which fields have non-null values
    for (const [key, value] of Object.entries(contextObj)) {
      if (value !== null && value !== undefined && value !== '') {
        // If it's an array, only count if non-empty
        if (Array.isArray(value)) {
          if (value.length > 0) usedFields.push(key);
        } else {
          usedFields.push(key);
        }
      }
    }

    return usedFields;
  }

  /**
   * Get agent performance metrics
   * How often agent is used, average confidence, etc.
   */
  async getAgentMetrics(brandId: number | string, agentId: string) {
    try {
      // This would query agent_learnings table
      // For now, return structure for future implementation
      return {
        agentId,
        totalUses: 0,
        averageConfidence: 0,
        totalInsights: 0,
        lastUsed: null,
        metrics: {}
      };
    } catch (error) {
      console.error(`[DatabaseContext] Error getting agent metrics:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const databaseContextService = new DatabaseContextService();

/**
 * Helper function for quick context retrieval
 * Usage:
 * const ctx = await getAgentContext(brandId, 'strategy');
 */
export async function getAgentContext(
  brandId: number | string,
  cluster: string
) {
  return databaseContextService.getAgentContextByCluster(brandId, cluster);
}

/**
 * Helper function to record learning
 * Usage:
 * await recordLearning(brandId, agentId, agentName, insight, fieldsUsed);
 */
export async function recordLearning(
  brandId: number | string,
  agentId: string,
  agentName: string,
  insight: string,
  fieldsUsed?: string[],
  confidence?: number
) {
  return databaseContextService.recordAgentLearning(
    brandId,
    agentId,
    agentName,
    insight,
    fieldsUsed,
    confidence
  );
}
