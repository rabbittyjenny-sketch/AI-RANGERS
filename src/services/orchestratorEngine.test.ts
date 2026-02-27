/**
 * OrchestratorEngine Tests
 * Tests routing, IP protection, intent recognition, and context filtering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorEngine } from './orchestratorEngine';
import type { MasterContext } from '../data/intelligence';

const mockContext: MasterContext = {
  brandId: 'brand_test_001',
  brandNameTh: 'คาเฟ่ทดสอบ',
  brandNameEn: 'Test Cafe',
  industry: 'Food & Beverage',
  isDefault: false,
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  coreUSP: ['Premium coffee', 'Sustainable beans'],
  toneOfVoice: 'casual',
  targetAudience: 'Young professionals 25-35',
  businessModel: 'B2C',
  competitors: ['Starbucks', 'Amazon Coffee'],
  visualStyle: {
    primaryColor: '#5E9BEB',
    moodKeywords: ['modern', 'warm', 'artisan'],
  },
  targetPersona: 'Urban creative 28yo, coffee enthusiast',
  painPoints: ['Too expensive', 'Inconsistent quality'],
  forbiddenWords: ['cheap', 'discount'],
};

describe('OrchestratorEngine — Context & Routing', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    engine = new OrchestratorEngine();
  });

  it('setMasterContext stores context and getMasterContext retrieves it', () => {
    engine.setMasterContext(mockContext);
    const ctx = engine.getMasterContext();
    expect(ctx?.brandId).toBe('brand_test_001');
    expect(ctx?.brandNameTh).toBe('คาเฟ่ทดสอบ');
  });

  it('checkReadiness: market-analyzer has no dependencies — always ready', () => {
    engine.setMasterContext(mockContext);
    const result = engine.checkReadiness('market-analyzer');
    expect(result.isReady).toBe(true);
    expect(result.missingDependencies).toHaveLength(0);
  });

  it('checkReadiness: visual-strategist is NOT ready before dependencies complete', () => {
    engine.setMasterContext(mockContext);
    const result = engine.checkReadiness('visual-strategist');
    expect(result.isReady).toBe(false);
    expect(result.missingDependencies.length).toBeGreaterThan(0);
  });

  it('markAgentCompleted tracks completion and checkReadiness updates', () => {
    engine.setMasterContext(mockContext);
    engine.markAgentCompleted('market-analyzer');
    engine.markAgentCompleted('positioning-strategist');
    // Now visual-strategist's dependencies should be met
    const result = engine.checkReadiness('visual-strategist');
    expect(result.isReady).toBe(true);
  });

  it('route: "วิเคราะห์ตลาด" routes to market-analyzer (strategy cluster)', () => {
    engine.setMasterContext(mockContext);
    const result = engine.route('วิเคราะห์ตลาดให้หน่อย SWOT competitor');
    expect(result.agent).not.toBeNull();
    expect(result.cluster).toBe('strategy');
  });

  it('route: "ออกแบบโลโก้" routes to creative cluster', () => {
    engine.setMasterContext(mockContext);
    const result = engine.route('ออกแบบโลโก้ brand identity');
    expect(result.cluster).toBe('creative');
  });

  it('recognizeIntent: strategy keywords detected correctly', () => {
    engine.setMasterContext(mockContext);
    const clusters = engine.recognizeIntent('ช่วยวิเคราะห์ตลาดและ SWOT');
    expect(clusters).toContain('strategy');
  });

  it('recognizeIntent: defaults to strategy for unknown input', () => {
    engine.setMasterContext(mockContext);
    const clusters = engine.recognizeIntent('xyzxyz123456');
    expect(clusters).toContain('strategy');
  });

  it('buildAgentContext filters to strategy fields for market-analyzer', () => {
    engine.setMasterContext(mockContext);
    const { masterContext } = engine.buildAgentContext('market-analyzer');
    expect(masterContext?.brandId).toBe('brand_test_001');
    expect(masterContext?.competitors).toBeDefined();
  });

  it('buildAgentContext filters to creative fields for visual-strategist', () => {
    engine.setMasterContext(mockContext);
    const { masterContext } = engine.buildAgentContext('visual-strategist');
    expect(masterContext?.visualStyle).toBeDefined();
    expect(masterContext?.coreUSP).toBeDefined();
  });

  it('needsTaskSpecificData returns true for first use of caption-creator', () => {
    engine.setMasterContext(mockContext);
    const needs = engine.needsTaskSpecificData('caption-creator');
    expect(typeof needs).toBe('boolean');
  });

  it('setTaskSpecificData stores and getTaskSpecificData retrieves', () => {
    const data = { platform: 'Instagram', contentType: 'Product Launch' };
    engine.setTaskSpecificData('caption-creator', data);
    const retrieved = engine.getTaskSpecificData('caption-creator');
    expect(retrieved?.platform).toBe('Instagram');
    expect(retrieved?.contentType).toBe('Product Launch');
  });
});

describe('OrchestratorEngine — IP Protection Rules', () => {
  let engine: OrchestratorEngine;

  beforeEach(() => {
    engine = new OrchestratorEngine();
    engine.setMasterContext(mockContext);
  });

  it('enforceBrandIsolation: allows access to own brand', () => {
    const result = engine.enforceBrandIsolation('brand_test_001');
    expect(result.allowed).toBe(true);
  });

  it('enforceBrandIsolation: denies access to different brand', () => {
    const result = engine.enforceBrandIsolation('brand_other_999');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('brand_other_999');
  });

  it('enforceBrandIsolation: denies when no context loaded', () => {
    const freshEngine = new OrchestratorEngine();
    const result = freshEngine.enforceBrandIsolation('brand_test_001');
    expect(result.allowed).toBe(false);
  });

  it('checkPlagiarismAndTrademark: clean content passes', () => {
    const result = engine.checkPlagiarismAndTrademark('เราคือแบรนด์กาแฟระดับพรีเมียม');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('checkPlagiarismAndTrademark: "just do it" triggers violation', () => {
    const result = engine.checkPlagiarismAndTrademark('Just Do It — สั่งเลย!');
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('checkPlagiarismAndTrademark: "i\'m lovin\' it" triggers violation', () => {
    const result = engine.checkPlagiarismAndTrademark("i'm lovin' it");
    expect(result.passed).toBe(false);
  });

  it('checkArtStyleProtection: clean prompt passes', () => {
    const result = engine.checkArtStyleProtection('modern and warm artisan feel');
    expect(result.passed).toBe(true);
    expect(result.suggestion).toBe('');
  });

  it('checkArtStyleProtection: "picasso style" is blocked', () => {
    const result = engine.checkArtStyleProtection('design in Picasso style');
    expect(result.passed).toBe(false);
    expect(result.suggestion).toContain('picasso');
    expect(result.suggestion).toContain('modern');
  });

  it('checkArtStyleProtection: "van gogh" is blocked', () => {
    const result = engine.checkArtStyleProtection('like van gogh painting');
    expect(result.passed).toBe(false);
  });

  it('runIPProtectionChecks: clean content fully passes', () => {
    const result = engine.runIPProtectionChecks('กาแฟระดับพรีเมียม รสชาติเข้มข้น');
    expect(result.overallPassed).toBe(true);
    expect(result.isolation.allowed).toBe(true);
    expect(result.plagiarism.passed).toBe(true);
    expect(result.artStyle.passed).toBe(true);
  });

  it('runIPProtectionChecks: trademark violation fails overall', () => {
    const result = engine.runIPProtectionChecks('Just Do It สั่งกาแฟเลย');
    expect(result.overallPassed).toBe(false);
    expect(result.plagiarism.passed).toBe(false);
  });
});
