/**
 * DatabaseService Tests
 * Tests localStorage fallback path (DB mocked as null)
 * and verifies BrandRecord interface completeness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB client to return null (localStorage path)
vi.mock('../db/client', () => ({ db: null }));

// Import AFTER mocking
const { databaseService } = await import('./databaseService');

const mockBrand = {
  brandNameEn: 'TestBrand',
  brandNameTh: 'แบรนด์ทดสอบ',
  industry: 'Food & Beverage',
  coreUsp: 'Premium quality, sustainable sourcing',
  businessModel: 'B2C',
  competitors: ['CompA', 'CompB'],
  targetAudience: 'Young professionals 25-35',
  targetPersona: 'Urban professional who values quality',
  primaryColor: '#5E9BEB',
  secondaryColors: ['#34D399', '#F59E0B'],
  fontFamily: ['Sarabun', 'Inter'],
  moodKeywords: ['modern', 'warm', 'trustworthy'],
  toneOfVoice: 'professional',
  multilingualLevel: 'EN-TH mix',
  forbiddenWords: ['cheap', 'low quality'],
  forbiddenElements: ['Neon colors', 'Cartoonish styles'],
  videoStyle: 'Cinematic, slow-paced',
  brandHashtags: ['#TestBrand', '#Premium'],
  automationEmail: 'test@brand.com',
  automationLineOa: '@testbrand',
  painPoints: ['Too expensive', 'Hard to find'],
};

describe('DatabaseService — localStorage fallback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveBrand stores brand to localStorage when DB is null', async () => {
    const result = await databaseService.saveBrand(mockBrand);
    expect(result.brandNameEn).toBe('TestBrand');
    expect(result.id).toBeDefined();
  });

  it('getBrand returns stored brand by name', async () => {
    await databaseService.saveBrand(mockBrand);
    const fetched = await databaseService.getBrand('TestBrand');
    expect(fetched).not.toBeNull();
    expect(fetched?.brandNameTh).toBe('แบรนด์ทดสอบ');
  });

  it('getBrand returns null for unknown brand', async () => {
    const result = await databaseService.getBrand('nonexistent');
    expect(result).toBeNull();
  });

  it('saveBrand accepts coreUsp as array', async () => {
    const brandWithArrayUsp = { ...mockBrand, coreUsp: ['Fast delivery', 'Great quality'] as any };
    const result = await databaseService.saveBrand(brandWithArrayUsp);
    expect(result.brandNameEn).toBe('TestBrand');
  });

  it('saveMessage stores message to localStorage', async () => {
    const msg = {
      brandId: 1,
      role: 'user' as const,
      agentId: 'market-analyzer',
      agentName: 'Market Analyzer',
      content: 'วิเคราะห์ตลาดให้หน่อย',
      confidence: 85,
    };
    const result = await databaseService.saveMessage(msg);
    expect(result.content).toBe('วิเคราะห์ตลาดให้หน่อย');
  });

  it('getConversationHistory returns stored messages for brandId', async () => {
    await databaseService.saveMessage({
      brandId: 99,
      role: 'agent' as const,
      content: 'ตอบกลับจาก agent',
      confidence: 80,
    });
    const messages = await databaseService.getConversationHistory(99);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content).toBe('ตอบกลับจาก agent');
  });

  it('saveAgentLearning stores learning record', async () => {
    const learning = {
      brandId: 1,
      agentId: 'market-analyzer',
      agentName: 'Market Analyzer',
      insight: 'Market is growing 15% YoY',
      insightType: 'Trend',
      dataUsed: ['competitors', 'marketTrends'],
      confidence: 80,
      actionable: true,
    };
    const result = await databaseService.saveAgentLearning(learning);
    expect(result.insight).toBe('Market is growing 15% YoY');
  });

  it('getStatus reports localStorage backend when DB is null', async () => {
    const status = await databaseService.getStatus();
    expect(status.backend).toContain('localStorage');
    expect(status.isReady).toBe(false);
  });

  it('BrandRecord supports all new schema fields', async () => {
    // All fields should serialize/deserialize without loss
    await databaseService.saveBrand(mockBrand);
    const fetched = await databaseService.getBrand('TestBrand');
    expect(fetched?.automationEmail).toBe('test@brand.com');
    expect(fetched?.automationLineOa).toBe('@testbrand');
    expect(fetched?.targetPersona).toBe('Urban professional who values quality');
    expect(fetched?.videoStyle).toBe('Cinematic, slow-paced');
  });
});
