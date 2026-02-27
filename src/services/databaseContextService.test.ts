/**
 * DatabaseContextService Tests
 * Tests smart lazy context distribution, cluster filtering,
 * and agent learning recording
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBrand = {
  id: 1,
  brandNameEn: 'Test Cafe',
  brandNameTh: 'คาเฟ่ทดสอบ',
  industry: 'Food & Beverage',
  coreUsp: 'premium sustainable',
  businessModel: 'B2C',
  competitors: ['CompA', 'CompB'],
  targetAudience: 'Young professionals',
  targetPersona: 'Urban creative 28yo',
  painPoints: ['Too expensive', 'Hard to find'],
  forbiddenWords: ['cheap', 'discount'],
  primaryColor: '#5E9BEB',
  secondaryColors: ['#34D399'],
  fontFamily: ['Sarabun', 'Inter'],
  moodKeywords: ['modern', 'warm'],
  videoStyle: 'Cinematic',
  forbiddenElements: ['Neon colors'],
  toneOfVoice: 'professional',
  multilingualLevel: 'EN-TH mix',
  brandHashtags: ['#TestCafe'],
  automationEmail: 'test@cafe.com',
  automationLineOa: '@testcafe',
};

// Mock databaseService
vi.mock('./databaseService', () => ({
  databaseService: {
    getBrand: vi.fn().mockResolvedValue(mockBrand),
    saveAgentLearning: vi.fn().mockResolvedValue({}),
  }
}));

const { databaseContextService, getAgentContext, recordLearning } = await import('./databaseContextService');

describe('DatabaseContextService — Smart Lazy Distribution', () => {
  beforeEach(() => {
    databaseContextService.clearBrandCache();
  });

  it('getAgentContextByCluster: strategy cluster returns businessModel and competitors', async () => {
    const ctx = await databaseContextService.getAgentContextByCluster(1, 'strategy') as any;
    expect(ctx).not.toBeNull();
    expect(ctx.businessModel).toBe('B2C');
    expect(ctx.competitors).toEqual(['CompA', 'CompB']);
    expect(ctx.industry).toBe('Food & Beverage');
  });

  it('getAgentContextByCluster: creative cluster returns visual fields', async () => {
    const ctx = await databaseContextService.getAgentContextByCluster(1, 'creative') as any;
    expect(ctx).not.toBeNull();
    expect(ctx.primaryColor).toBe('#5E9BEB');
    expect(ctx.secondaryColors).toEqual(['#34D399']);
    expect(ctx.moodKeywords).toEqual(['modern', 'warm']);
    expect(ctx.videoStyle).toBe('Cinematic');
    expect(ctx.forbiddenElements).toEqual(['Neon colors']);
  });

  it('getAgentContextByCluster: growth cluster returns agency fields', async () => {
    const ctx = await databaseContextService.getAgentContextByCluster(1, 'growth') as any;
    expect(ctx).not.toBeNull();
    expect(ctx.toneOfVoice).toBe('professional');
    expect(ctx.targetAudience).toBe('Young professionals');
    expect(ctx.targetPersona).toBe('Urban creative 28yo');
    expect(ctx.painPoints).toEqual(['Too expensive', 'Hard to find']);
    expect(ctx.forbiddenWords).toEqual(['cheap', 'discount']);
    expect(ctx.automationEmail).toBe('test@cafe.com');
    expect(ctx.automationLineOa).toBe('@testcafe');
  });

  it('getAgentContextByCluster: unknown cluster returns null', async () => {
    const ctx = await databaseContextService.getAgentContextByCluster(1, 'unknown_cluster');
    expect(ctx).toBeNull();
  });

  it('getAgentContextByCluster: returns null when brand not found', async () => {
    const { databaseService } = await import('./databaseService');
    (databaseService.getBrand as any).mockResolvedValueOnce(null);
    const ctx = await databaseContextService.getAgentContextByCluster(999, 'strategy');
    expect(ctx).toBeNull();
  });

  it('getCompleteAgentContext: returns all 3 cluster contexts', async () => {
    const complete = await databaseContextService.getCompleteAgentContext(1);
    expect(complete).not.toBeNull();
    expect(complete?.strategist).toBeDefined();
    expect(complete?.creative).toBeDefined();
    expect(complete?.agency).toBeDefined();
    expect(complete?.timestamp).toBeDefined();
    expect(complete?.brandId).toBe(1);
  });

  it('caching: second call uses cache, not a second DB fetch', async () => {
    const { databaseService } = await import('./databaseService');
    const spy = databaseService.getBrand as any;
    spy.mockClear();
    await databaseContextService.getAgentContextByCluster(1, 'strategy');
    await databaseContextService.getAgentContextByCluster(1, 'creative');
    // Should only fetch once (cached after first call)
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clearBrandCache: forces fresh DB fetch on next call', async () => {
    const { databaseService } = await import('./databaseService');
    const spy = databaseService.getBrand as any;
    spy.mockClear();
    await databaseContextService.getAgentContextByCluster(1, 'strategy');
    databaseContextService.clearBrandCache(1);
    await databaseContextService.getAgentContextByCluster(1, 'strategy');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('DatabaseContextService — getFieldsUsedByAgent', () => {
  it('returns non-empty fields from a context object', () => {
    const ctx = {
      brandId: 1,
      industry: 'Food',
      competitors: ['A', 'B'],
      businessModel: '',  // empty — should NOT be included
    };
    const fields = databaseContextService.getFieldsUsedByAgent('market-analyzer', ctx as any);
    expect(fields).toContain('brandId');
    expect(fields).toContain('industry');
    expect(fields).toContain('competitors');
    expect(fields).not.toContain('businessModel');
  });

  it('returns empty array when context is null', () => {
    const fields = databaseContextService.getFieldsUsedByAgent('any-agent', null);
    expect(fields).toHaveLength(0);
  });
});

describe('DatabaseContextService — recordAgentLearning', () => {
  it('records a learning insight without throwing', async () => {
    await expect(
      databaseContextService.recordAgentLearning(
        1,
        'market-analyzer',
        'Market Analyzer',
        'Market growing 10% YoY',
        ['competitors', 'industry'],
        80,
        'Trend'
      )
    ).resolves.not.toThrow();
  });

  it('getAgentMetrics returns structured metrics object', async () => {
    const metrics = await databaseContextService.getAgentMetrics(1, 'market-analyzer');
    expect(metrics).not.toBeNull();
    expect(metrics?.agentId).toBe('market-analyzer');
    expect(typeof metrics?.totalUses).toBe('number');
  });
});

describe('Module helper functions', () => {
  it('getAgentContext shorthand works', async () => {
    const ctx = await getAgentContext(1, 'strategy');
    expect(ctx).not.toBeNull();
  });

  it('recordLearning shorthand works without throwing', async () => {
    await expect(
      recordLearning(1, 'market-analyzer', 'Market Analyzer', 'Insight text', ['industry'], 75)
    ).resolves.not.toThrow();
  });
});
