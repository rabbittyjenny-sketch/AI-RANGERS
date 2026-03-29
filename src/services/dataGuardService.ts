/**
 * Enhanced Data Validation & Fact Checking System
 *
 * หลักการ:
 * - BLOCKED: เฉพาะการละเมิดจริงๆ (cross-brand access, trademark, artist IP)
 * - WARNING: ข้อมูลไม่ครบ, ไม่มี brand data → แจ้งเตือนแต่ไม่ block
 * - PASSED: ผ่านปกติ
 *
 * ห้าม block เพราะ user ไม่กรอกข้อมูลแบรนด์ (guest) —
 * นั่นเป็นสิทธิ์ของ user ที่จะเลือกไม่กรอก
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (context: any, content: string, metadata?: any) => ValidationResult;
}

export interface ValidationResult {
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  source?: string;
}

export interface DataGuardReport {
  contentId?: string;
  timestamp: string;
  checks: {
    isolation: ValidationResult;
    antiCopycat: ValidationResult;
    factCheck: ValidationResult;
    uspGrounding: ValidationResult;
    referenceValidation: ValidationResult;
    consistency: ValidationResult;
  };
  overallStatus: 'passed' | 'warning' | 'blocked';
  recommendations: string[];
}

/**
 * 1. ISOLATION GUARD
 * Block เฉพาะตอนที่ content พยายาม access ข้อมูลแบรนด์อื่น
 * ไม่ block เพราะ guest / ไม่มีข้อมูลแบรนด์
 */
export const isolationGuard: ValidationRule = {
  id: 'isolation',
  name: 'Brand Data Isolation',
  description: 'ป้องกัน cross-brand data access เท่านั้น',
  severity: 'error',
  check: (context: any, content: string) => {
    // ถ้าไม่มี brandId หรือเป็น guest → pass (warning เท่านั้น ไม่ block)
    if (!context || !context.brandId || context.brandId === 'guest') {
      return {
        passed: true,
        severity: 'info',
        message: '✅ ผ่าน — ยังไม่มีข้อมูลแบรนด์ (ไม่บังคับ)',
      };
    }

    // ตรวจเฉพาะกรณีที่ content พยายาม access ข้ามแบรนด์จริงๆ
    const crossBrandPatterns = [
      /clone.*brand|steal.*brand|copy.*competitor.*data/gi,
      /access.*other.*brand|other.*brand.*data/gi,
    ];

    for (const pattern of crossBrandPatterns) {
      if (pattern.test(content)) {
        return {
          passed: false,
          severity: 'error',
          message: '❌ ตรวจพบการพยายามเข้าถึงข้อมูลแบรนด์อื่น',
          suggestion: 'ใช้เฉพาะข้อมูลแบรนด์ของคุณเท่านั้น',
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: `✅ ผ่าน — Brand isolation ปลอดภัย`,
      source: `Brand ID: ${context.brandId}`,
    };
  },
};

/**
 * 2. ANTI-COPYCAT GUARD
 * ตรวจ similarity และ artist IP
 * ไม่ block เพราะ originalContent ว่าง (ไม่มีอะไรให้เปรียบเทียบ)
 */
export const antiCopycatGuard: ValidationRule = {
  id: 'antiCopycat',
  name: 'Anti-Copycat & IP Protection',
  description: 'ป้องกันการลอกงานและละเมิด IP',
  severity: 'warning',
  check: (context: any, newContent: string, metadata?: any) => {
    const originalContent = metadata?.originalContent || '';

    // ไม่มีต้นฉบับเปรียบเทียบ → pass เสมอ
    if (!originalContent) {
      return {
        passed: true,
        severity: 'info',
        message: '✅ ผ่าน — ไม่มีต้นฉบับเปรียบเทียบ',
      };
    }

    const similarity = calculateStringSimilarity(originalContent, newContent);

    if (similarity > 0.9) {
      return {
        passed: false,
        severity: 'error',
        message: `❌ ความคล้ายคลึง ${Math.round(similarity * 100)}% — ต้องเปลี่ยนแปลงอย่างแท้จริง`,
        suggestion: 'ปรับ Brand Voice และโครงสร้างประโยคให้แตกต่างขึ้น',
      };
    }

    if (similarity > 0.7) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ ความคล้ายคลึง ${Math.round(similarity * 100)}% — พิจารณาปรับปรุง`,
        suggestion: 'ลองเปลี่ยนโครงสร้างประโยคให้มากขึ้น',
      };
    }

    // ตรวจชื่อศิลปินที่มีตัวตน
    const artistPatterns = [/picasso|warhol|monet|van gogh|banksy|kaws/gi];
    for (const pattern of artistPatterns) {
      if (pattern.test(newContent)) {
        return {
          passed: false,
          severity: 'warning',
          message: '⚠️ ห้ามอ้างชื่อศิลปินที่มีตัวตน — ใช้ Mood Keywords แทน',
          suggestion: 'เช่น แทน "Picasso style" ให้ใช้ "Cubist and artistic"',
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: `✅ ผ่าน — ความคล้ายคลึง ${Math.round(similarity * 100)}%`,
    };
  },
};

/**
 * 3. FACT CHECK GUARD
 * ตรวจ hallucination markers
 * warning เท่านั้น ไม่ block — เพราะ Claude อาจใช้คำเหล่านี้ตามบริบทปกติ
 */
export const factCheckGuard: ValidationRule = {
  id: 'factCheck',
  name: 'Fact Check & No Hallucination',
  description: 'ตรวจสอบข้อมูลที่อาจเป็น hallucination',
  severity: 'warning',
  check: (context: any, content: string) => {
    // ตรวจเฉพาะตัวเลขที่อาจเป็น hallucination + ไม่มีแหล่งที่มา
    const highRiskPatterns = [
      /\d+%\s*(increase|decrease|growth|เพิ่ม|ลด|เติบโต)/gi,
      /\$\d+[KMB]?\s*(revenue|sales|profit|รายได้|ยอดขาย)/gi,
    ];

    let hasHighRisk = false;
    const found: string[] = [];

    for (const pattern of highRiskPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        hasHighRisk = true;
        found.push(matches[0]);
      }
    }

    if (hasHighRisk) {
      // warning เท่านั้น ไม่ block
      return {
        passed: true,
        severity: 'warning',
        message: `⚠️ พบตัวเลขที่ควรระบุแหล่งที่มา: ${found.slice(0, 2).join(', ')}`,
        suggestion: 'เพิ่มคำว่า "ประมาณการ" หรือระบุแหล่งที่มา',
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน — ไม่พบข้อมูลที่น่าสงสัย',
    };
  },
};

/**
 * 4. USP GROUNDING GUARD
 * ตรวจว่า output ขัดกับ USP ของแบรนด์ไหม
 * ถ้าไม่มี USP → pass เสมอ
 */
export const uspGroundingGuard: ValidationRule = {
  id: 'uspGrounding',
  name: 'USP Grounding',
  description: 'ตรวจความสอดคล้องกับ Core USP',
  severity: 'warning',
  check: (context: any, content: string) => {
    if (!context?.coreUSP) {
      return {
        passed: true,
        severity: 'info',
        message: '⏭️ ข้ามการตรวจสอบ — ไม่พบ Core USP',
      };
    }

    const usp = context.coreUSP.toLowerCase();
    const contentLower = content.toLowerCase();

    const contradictions = [
      { usp: 'sustainable|eco|green', opposite: 'plastic|disposable', label: 'Eco' },
      { usp: 'premium|luxury|high-end', opposite: 'cheap|budget', label: 'Premium' },
      { usp: 'fast|quick|speed', opposite: 'slow|delay', label: 'Speed' },
    ];

    for (const contra of contradictions) {
      const uspMatches = new RegExp(contra.usp).test(usp);
      const oppositeMatches = new RegExp(contra.opposite).test(contentLower);

      if (uspMatches && oppositeMatches) {
        return {
          passed: false,
          severity: 'warning',
          message: `⚠️ เนื้อหาอาจขัดกับ USP (${contra.label})`,
          suggestion: `ตรวจสอบให้สอดคล้องกับ USP: "${context.coreUSP}"`,
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน — เนื้อหาสอดคล้องกับ USP',
    };
  },
};

/**
 * 5. REFERENCE VALIDATION GUARD
 * warning เท่านั้น ไม่ block
 */
export const referenceValidationGuard: ValidationRule = {
  id: 'referenceValidation',
  name: 'Reference Validation',
  description: 'ตรวจการอ้างอิงแหล่งที่มา',
  severity: 'info',
  check: (context: any, content: string) => {
    const dataMentions = [/\d+%/g, /research|study|survey/gi];
    const citationPatterns = [/\[source|according to|อ้างอิง|ที่มา/gi];

    const hasDataClaims = dataMentions.some(p => p.test(content));
    const hasCitations = citationPatterns.some(p => p.test(content));

    if (hasDataClaims && !hasCitations) {
      return {
        passed: true,
        severity: 'warning',
        message: '⚠️ มีข้อมูลเชิงตัวเลขแต่ไม่มีแหล่งที่มา',
        suggestion: 'ควรระบุแหล่งที่มาหรือใช้คำว่า "ประมาณการ"',
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน',
    };
  },
};

/**
 * 6. CONSISTENCY CHECK GUARD
 * ตรวจ tone mismatch
 * warning เท่านั้น ไม่ block
 */
export const consistencyCheckGuard: ValidationRule = {
  id: 'consistency',
  name: 'Consistency Check',
  description: 'ตรวจ tone และ mood alignment',
  severity: 'warning',
  check: (context: any, content: string) => {
    if (!context?.toneOfVoice) {
      return {
        passed: true,
        severity: 'info',
        message: '⏭️ ข้ามการตรวจสอบ — ไม่พบ Tone of Voice',
      };
    }

    const toneChecks: Record<string, RegExp[]> = {
      formal: [/lol|omg|haha|lmao/gi],
      professional: [/yo dude|bro|pal/gi],
    };

    const tone = context.toneOfVoice as string;
    if (toneChecks[tone]?.[0]?.test(content)) {
      return {
        passed: true,
        severity: 'warning',
        message: `⚠️ ภาษาอาจไม่ตรงกับ Tone (${tone})`,
        suggestion: 'ปรับโทนภาษาให้เหมาะกับแบรนด์',
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน — Tone สอดคล้องกับแบรนด์',
    };
  },
};

// ── Helper ────────────────────────────────────────────────────────────────────

function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/\s+/g, '');
  const s2 = str2.toLowerCase().replace(/\s+/g, '');
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// ── Master Guardian ───────────────────────────────────────────────────────────

export class DataGuardian {
  private rules: ValidationRule[] = [
    isolationGuard,
    antiCopycatGuard,
    factCheckGuard,
    uspGroundingGuard,
    referenceValidationGuard,
    consistencyCheckGuard,
  ];

  async validateContent(
    context: any,
    content: string,
    metadata?: any,
    contentId?: string
  ): Promise<DataGuardReport> {
    const report: DataGuardReport = {
      contentId,
      timestamp: new Date().toISOString(),
      checks: {
        isolation: { passed: true, severity: 'info', message: 'Pending' },
        antiCopycat: { passed: true, severity: 'info', message: 'Pending' },
        factCheck: { passed: true, severity: 'info', message: 'Pending' },
        uspGrounding: { passed: true, severity: 'info', message: 'Pending' },
        referenceValidation: { passed: true, severity: 'info', message: 'Pending' },
        consistency: { passed: true, severity: 'info', message: 'Pending' },
      },
      recommendations: [],
      overallStatus: 'passed',
    };

    for (const rule of this.rules) {
      const result = rule.check(context, content, metadata);
      (report.checks as any)[rule.id] = result;

      if (!result.passed) {
        // blocked เฉพาะ error severity เท่านั้น
        if (result.severity === 'error') {
          report.overallStatus = 'blocked';
        } else if (result.severity === 'warning' && report.overallStatus === 'passed') {
          report.overallStatus = 'warning';
        }
      }

      if (result.suggestion) {
        report.recommendations.push(`[${rule.name}] ${result.suggestion}`);
      }
    }

    return report;
  }

  generateReport(report: DataGuardReport): string {
    const lines = [
      `📋 Data Guard Report — ${report.timestamp}`,
      `Status: ${report.overallStatus.toUpperCase()}`,
      '',
      '🔍 Checks:',
    ];

    for (const [, result] of Object.entries(report.checks)) {
      const r = result as ValidationResult;
      const icon = r.passed ? '✅' : r.severity === 'error' ? '❌' : '⚠️';
      lines.push(`${icon} ${r.message}`);
    }

    if (report.recommendations.length > 0) {
      lines.push('', '💡 Recommendations:');
      report.recommendations.forEach(rec => lines.push(`   • ${rec}`));
    }

    return lines.join('\n');
  }
}

export const dataGuardian = new DataGuardian();
