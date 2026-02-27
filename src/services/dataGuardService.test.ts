/**
 * DataGuardService Tests
 * Tests all 6 guard checks: Isolation, AntiCopycat, FactCheck,
 * USPGrounding, ReferenceValidation, Consistency
 */

import { describe, it, expect } from 'vitest';
import {
  isolationGuard,
  antiCopycatGuard,
  factCheckGuard,
  uspGroundingGuard,
  referenceValidationGuard,
  dataGuardian,
} from './dataGuardService';

const brandContext = {
  brandId: 'brand_001',
  brandNameTh: 'แบรนด์พรีเมียม',
  coreUSP: 'premium sustainable luxury',
};

// ─────────────────────────────────────────
// 1. ISOLATION GUARD
// ─────────────────────────────────────────
describe('IsolationGuard', () => {
  it('passes when brandId is present', () => {
    const result = isolationGuard.check(brandContext, 'สินค้าดีมาก');
    expect(result.passed).toBe(true);
  });

  it('fails when context has no brandId', () => {
    const result = isolationGuard.check({}, 'test content');
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('fails when content contains cross-brand access pattern', () => {
    const result = isolationGuard.check(brandContext, 'clone competitor brand data');
    expect(result.passed).toBe(false);
  });

  it('fails when context is null', () => {
    const result = isolationGuard.check(null, 'test');
    expect(result.passed).toBe(false);
  });
});

// ─────────────────────────────────────────
// 2. ANTI-COPYCAT GUARD
// ─────────────────────────────────────────
describe('AntiCopycatGuard', () => {
  it('passes when no original content to compare', () => {
    const result = antiCopycatGuard.check(brandContext, 'เนื้อหาใหม่สร้างสรรค์');
    expect(result.passed).toBe(true);
  });

  it('passes when similarity is low (<70%)', () => {
    const original = 'The quick brown fox jumps over the lazy dog';
    const newContent = 'สุนัขสีน้ำตาลกระโดดข้ามรั้ว — completely different content here';
    const result = antiCopycatGuard.check(brandContext, newContent, { originalContent: original });
    expect(result.passed).toBe(true);
  });

  it('fails when content mentions banned artist names (with originalContent provided)', () => {
    // Artist check is only reached when originalContent is provided and similarity is ok
    const result = antiCopycatGuard.check(
      brandContext,
      'Picasso-inspired design concept for the modern branding creative approach',
      { originalContent: 'A completely different unrelated text about something else entirely' }
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });

  it('fails with error when similarity is very high (>90%)', () => {
    const content = 'The quick brown fox jumps over the lazy dog in the yard';
    // Near-identical content
    const result = antiCopycatGuard.check(brandContext, content, { originalContent: content });
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });
});

// ─────────────────────────────────────────
// 3. FACT CHECK GUARD
// ─────────────────────────────────────────
describe('FactCheckGuard', () => {
  it('passes for clean qualitative content', () => {
    const result = factCheckGuard.check(brandContext, 'แบรนด์เราเน้นคุณภาพและความยั่งยืน');
    expect(result.passed).toBe(true);
  });

  it('warns when content contains unsourced statistics', () => {
    // Pattern: \d+%\s+(increase|decrease|growth) — "45% growth" matches
    const result = factCheckGuard.check(brandContext, 'Market saw 45% growth this year');
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.suggestion).toContain('ประมาณการ');
  });

  it('warns for dollar revenue claims', () => {
    const result = factCheckGuard.check(brandContext, 'Generated $5M revenue in Q3');
    expect(result.passed).toBe(false);
  });

  it('warns for "study shows" without source', () => {
    const result = factCheckGuard.check(brandContext, 'Research shows customers prefer our product');
    expect(result.passed).toBe(false);
  });

  it('passes for content with "ประมาณการ" qualifier', () => {
    const result = factCheckGuard.check(brandContext, 'เติบโตประมาณ 20% (ประมาณการ)');
    // "ประมาณการ" is in Thai so pattern won't match — should pass
    expect(result.passed).toBe(true);
  });
});

// ─────────────────────────────────────────
// 4. USP GROUNDING GUARD
// ─────────────────────────────────────────
describe('USPGroundingGuard', () => {
  it('skips check when no coreUSP in context', () => {
    const result = uspGroundingGuard.check({}, 'any content here');
    expect(result.passed).toBe(true);
    expect(result.message).toContain('ข้ามการตรวจสอบ');
  });

  it('warns when premium USP contradicts cheap content', () => {
    const ctx = { ...brandContext, coreUSP: 'premium luxury high-end' };
    const result = uspGroundingGuard.check(ctx, 'This is the cheapest budget option available');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Premium');
  });

  it('warns when sustainable USP contradicts plastic content', () => {
    const ctx = { ...brandContext, coreUSP: 'sustainable eco-friendly green' };
    const result = uspGroundingGuard.check(ctx, 'Made from disposable plastic materials');
    expect(result.passed).toBe(false);
    expect(result.message).toContain('Environmental');
  });

  it('passes when USP keywords appear in content', () => {
    const ctx = { ...brandContext, coreUSP: 'premium' };
    const result = uspGroundingGuard.check(ctx, 'premium quality beans from sustainable farms');
    expect(result.passed).toBe(true);
  });

  it('warns for long content with zero USP keyword matches', () => {
    const ctx = { ...brandContext, coreUSP: 'premium sustainable' };
    // Long content (>100 chars) with no USP keywords
    const longUnrelatedContent = 'A'.repeat(101);
    const result = uspGroundingGuard.check(ctx, longUnrelatedContent);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('USP');
  });
});

// ─────────────────────────────────────────
// 5. REFERENCE VALIDATION GUARD
// ─────────────────────────────────────────
describe('ReferenceValidationGuard', () => {
  it('passes for content with no citation required', () => {
    const result = referenceValidationGuard.check(brandContext, 'สินค้าดีมากค่ะ');
    expect(result.passed).toBe(true);
  });

  it('passes when citations are properly formatted', () => {
    const content = 'Market data shows growth [source: Nielsen 2024]';
    const result = referenceValidationGuard.check(brandContext, content, {
      references: ['Nielsen 2024']
    });
    expect(result.passed).toBe(true);
  });
});

// ─────────────────────────────────────────
// 6. DATA GUARDIAN (Full Report)
// ─────────────────────────────────────────
describe('DataGuardian — Full Report (validateContent)', () => {
  it('generates a complete DataGuardReport with all 6 checks', async () => {
    const report = await dataGuardian.validateContent(brandContext, 'สินค้าของเราดีมาก premium quality');
    expect(report).toBeDefined();
    expect(report.checks).toBeDefined();
    expect(report.checks.isolation).toBeDefined();
    expect(report.checks.antiCopycat).toBeDefined();
    expect(report.checks.factCheck).toBeDefined();
    expect(report.checks.uspGrounding).toBeDefined();
    expect(report.checks.referenceValidation).toBeDefined();
    expect(report.checks.consistency).toBeDefined();
    expect(report.overallStatus).toMatch(/passed|warning|blocked/);
    expect(typeof report.timestamp).toBe('string');
  });

  it('status is not "blocked" for clean brand-consistent content', async () => {
    const ctx = { ...brandContext, coreUSP: 'premium quality sustainable' };
    const report = await dataGuardian.validateContent(ctx, 'premium sustainable quality coffee');
    expect(report.overallStatus).not.toBe('blocked');
  });

  it('status is "blocked" when isolation check fails (no brandId)', async () => {
    const report = await dataGuardian.validateContent({}, 'test content');
    expect(report.overallStatus).toBe('blocked');
  });

  it('recommendations array is always present', async () => {
    const report = await dataGuardian.validateContent(brandContext, 'test');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('generateReport returns a formatted string', async () => {
    const report = await dataGuardian.validateContent(brandContext, 'กาแฟระดับพรีเมียม');
    const formatted = dataGuardian.generateReport(report);
    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('Data Guard Report');
    expect(formatted).toContain('Status:');
  });
});
