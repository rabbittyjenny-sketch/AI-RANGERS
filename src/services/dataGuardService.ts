/**
 * Enhanced Data Validation & Fact Checking System
 * เพิ่มเติมความมั่นใจของระบบ (System Reliability Guards)
 *
 * Implements:
 * ✅ Brand Data Isolation
 * ✅ Anti-Copycat & IP Protection
 * ✅ Fact Check & Integrity (No Hallucination)
 * ✅ USP Grounding
 * ✅ Reference Validation
 * ✅ Consistency Checks
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
 * 1. ISOLATION GUARD - Brand Data Protection
 */
export const isolationGuard: ValidationRule = {
  id: 'isolation',
  name: 'Brand Data Isolation',
  description: 'ห้ามแชร์ข้อมูลข้าม brand_id โดยเด็ดขาด',
  severity: 'error',
  check: (context: any, content: string) => {
    if (!context || !context.brandId) {
      return {
        passed: false,
        severity: 'error',
        message: '❌ ไม่พบ Brand Context - ไม่สามารถตรวจสอบการแยกข้อมูล',
        suggestion: 'โปรดเข้าสู่ระบบและเลือกแบรนด์ของคุณ'
      };
    }

    // Check if content contains references to other brands
    const forbiddenPatterns = [
      /clone|copy|duplicate.*brand|steal/gi,
      /competitor.*data|other.*brand.*info/gi
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        return {
          passed: false,
          severity: 'error',
          message: '❌ ตรวจพบความพยายามเข้าถึงข้อมูลแบรนด์อื่น',
          suggestion: '⚠️ ระบบปฏิเสธการเข้าถึง - ใช้เฉพาะข้อมูลแบรนด์ของคุณเท่านั้น'
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน - ข้อมูลแยกตัวอักษรเรียบร้อย',
      source: `Brand ID: ${context.brandId}`
    };
  }
};

/**
 * 2. ANTI-COPYCAT GUARD - Plagiarism Prevention
 */
export const antiCopycatGuard: ValidationRule = {
  id: 'antiCopycat',
  name: 'Anti-Copycat & IP Protection',
  description: 'ป้องกันการเลียนแบบ Rephrase อย่างแท้จริง',
  severity: 'warning',
  check: (context: any, newContent: string, metadata?: any) => {
    const originalContent = metadata?.originalContent || '';

    if (!originalContent) {
      return {
        passed: true,
        severity: 'info',
        message: '✅ เป็นเนื้อหาใหม่ - ไม่มีต้นฉบับเปรียบเทียบ'
      };
    }

    // Simple similarity check (Levenshtein-like)
    const similarity = calculateStringSimilarity(originalContent, newContent);

    if (similarity > 0.9) {
      return {
        passed: false,
        severity: 'error',
        message: `❌ ความคล้ายคลึง ${Math.round(similarity * 100)}% - ต้องเปลี่ยนแปลงอย่างแท้จริง`,
        suggestion: '✓ ให้ปรับปรุง Brand Voice/Tone ของคุณเข้าไปมากขึ้น'
      };
    }

    if (similarity > 0.7) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ ความคล้ายคลึง ${Math.round(similarity * 100)}% - อาจจำเป็นปรับปรุง`,
        suggestion: '✓ ลองเปลี่ยนโครงสร้างประโยค/คำศัพท์ให้มากขึ้น'
      };
    }

    // Check for banned artist names (if using specific art style)
    const artistPatterns = [
      /picasso|warhol|monet|van gogh|banksy|kaws/gi
    ];

    for (const pattern of artistPatterns) {
      if (pattern.test(newContent)) {
        return {
          passed: false,
          severity: 'warning',
          message: '⚠️ ต้องระวัง - ห้ามใช้ศิลปินที่มีตัวตน จงใช้ Mood Keywords แทน',
          suggestion: '✓ เช่น แทนที่ "Picasso style" ให้ใช้ "Cubist and artistic"'
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: `✅ ผ่าน - ความคล้ายคลึง ${Math.round(similarity * 100)}% (ยอมรับ <70%)`
    };
  }
};

/**
 * 3. FACT CHECK GUARD - No Hallucination
 */
export const factCheckGuard: ValidationRule = {
  id: 'factCheck',
  name: 'Fact Check & No Hallucination',
  description: 'ห้ามบอกเท็จ ถ้าไม่แน่ใจต้องระบุ "ประมาณการ"',
  severity: 'error',
  check: (context: any, content: string, metadata?: any) => {
    const hallucIndicators = [
      { pattern: /\d+%\s+(increase|decrease|growth)/gi, risk: 'high' },
      { pattern: /\$\d+[KM]?\s+(revenue|sales|profit)/gi, risk: 'high' },
      { pattern: /(study|research|report)\s+shows|found that/gi, risk: 'medium' },
      { pattern: /(according to|data reveals|statistics show)/gi, risk: 'medium' }
    ];

    let hasHallucination = false;
    let hallucDetails = [];

    for (const { pattern, risk } of hallucIndicators) {
      const matches = content.match(pattern);
      if (matches) {
        hasHallucination = true;
        hallucDetails.push(`${risk.toUpperCase()}: "${matches[0]}"`);
      }
    }

    if (hasHallucination) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ ตรวจพบข้อมูลเชิงปริมาณที่อาจไม่มีแหล่งที่มา`,
        suggestion: `✓ ให้เพิ่มคำว่า "ประมาณการ" หรือ "อ้างอิงจาก..." ข้อมูล: ${hallucDetails.join(', ')}`,
        source: `Potential hallucination: ${hallucDetails.length} items detected`
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน - ไม่มีข้อมูลที่อาจเป็นการมโนข้อมูล'
    };
  }
};

/**
 * 4. USP GROUNDING GUARD - Brand Consistency
 */
export const uspGroundingGuard: ValidationRule = {
  id: 'uspGrounding',
  name: 'USP Grounding',
  description: 'ทุกคำกล่าวอ้างต้องสอดคล้องกับ Core USP',
  severity: 'warning',
  check: (context: any, content: string) => {
    if (!context || !context.coreUSP) {
      return {
        passed: true,
        severity: 'info',
        message: '⏭️ ข้ามการตรวจสอบ - ไม่พบ Core USP'
      };
    }

    const usp = context.coreUSP.toLowerCase();
    const content_lower = content.toLowerCase();

    // Check for contradictions
    const contradictions = [
      { usp: 'sustainable|eco|green', opposite: 'plastic|disposable|waste', label: 'Environmental' },
      { usp: 'premium|luxury|high-end', opposite: 'cheap|budget|economy', label: 'Premium' },
      { usp: 'fast|quick|speed', opposite: 'slow|delay|waiting', label: 'Speed' },
      { usp: 'safe|secure|protect', opposite: 'risk|danger|unsafe', label: 'Safety' }
    ];

    for (const contra of contradictions) {
      const uspMatches = new RegExp(contra.usp).test(usp);
      const oppositeMatches = new RegExp(contra.opposite).test(content_lower);

      if (uspMatches && oppositeMatches) {
        return {
          passed: false,
          severity: 'warning',
          message: `⚠️ คำกล่าวขัดกับ USP (${contra.label})`,
          suggestion: `✓ USP ของคุณ: "${context.coreUSP}" - ให้ปรับเนื้อหาให้สอดคล้อง`,
          source: `USP: ${context.coreUSP}`
        };
      }
    }

    // Check if content at least mentions USP keywords
    const uspWords = context.coreUSP.split(' ').filter((w: string) => w.length > 3);
    const matchedWords = uspWords.filter((word: string) => content_lower.includes(word.toLowerCase()));

    if (matchedWords.length === 0 && content.length > 100) {
      return {
        passed: false,
        severity: 'warning',
        message: '⚠️ เนื้อหาไม่ได้เน้นจุดเด่นของแบรนด์ (USP)',
        suggestion: `✓ ให้เพิ่มองค์ประกอบจากนี้: "${context.coreUSP}"`,
        source: `Expected: ${uspWords.join(', ')}`
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน - เนื้อหาสอดคล้องกับ Core USP',
      source: `USP: ${context.coreUSP}`
    };
  }
};

/**
 * 5. REFERENCE VALIDATION GUARD
 */
export const referenceValidationGuard: ValidationRule = {
  id: 'referenceValidation',
  name: 'Reference Validation',
  description: 'ต้องระบุแหล่งที่มาเมื่ออ้างอิงข้อมูล',
  severity: 'warning',
  check: (context: any, content: string, metadata?: any) => {
    const references = metadata?.references || [];

    // Check for citation patterns
    const citationPatterns = [
      /\[source.*?\]/gi,
      /according to.*?\(/gi,
      /\(source:.*?\)/gi,
      /ref\. \d+/gi,
      /via|from|per/gi
    ];

    let hasCitations = citationPatterns.some(p => p.test(content));

    // If content mentions data/trends but no citations
    const dataMentions = [
      /trend|viral|trending|popular/gi,
      /\d+%/g,
      /research|study|survey/gi
    ];

    const hasDataClaims = dataMentions.some(p => p.test(content));

    if (hasDataClaims && !hasCitations && references.length === 0) {
      return {
        passed: false,
        severity: 'warning',
        message: '⚠️ ข้อมูลกำลังถูกอ้างอิง แต่ไม่มีแหล่งที่มา',
        suggestion: '✓ ให้เพิ่มแหล่งที่มาเช่น "อ้างอิงจากเทรนด์ TikTok วันนี้" หรือ "ประมาณการตามสำรวจ"',
        source: 'Data claims detected without citations'
      };
    }

    if (hasCitations || references.length > 0) {
      return {
        passed: true,
        severity: 'info',
        message: `✅ ผ่าน - มีการระบุแหล่งที่มา (${references.length} sources)`,
        source: `References: ${references.join(', ')}`
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน - ไม่มีข้อมูลที่ต้องระบุแหล่งที่มา'
    };
  }
};

/**
 * 6. CONSISTENCY CHECK GUARD
 */
export const consistencyCheckGuard: ValidationRule = {
  id: 'consistency',
  name: 'Consistency Check',
  description: 'ตรวจทานความสอดคล้องกับ Brand Voice & Master Context',
  severity: 'warning',
  check: (context: any, content: string) => {
    if (!context) {
      return {
        passed: true,
        severity: 'info',
        message: '⏭️ ข้ามการตรวจสอบ - ไม่พบ Master Context'
      };
    }

    const issues = [];

    // 1. Tone Check
    if (context.toneOfVoice) {
      const toneChecks = {
        formal: [/lol|omg|omgggg|haha|lmao/gi],
        playful: [/however|thus|furthermore|nevertheless/gi],
        professional: [/yo|dude|bro|pal/gi]
      };

      const tone = context.toneOfVoice as keyof typeof toneChecks;
      if (toneChecks[tone] && toneChecks[tone][0].test(content)) {
        issues.push(`Tone mismatch: ${context.toneOfVoice} tone doesn't fit the language used`);
      }
    }

    // 2. Mood Keywords Check
    if (context.visualStyle?.moodKeywords && context.visualStyle.moodKeywords.length > 0) {
      const moods = context.visualStyle.moodKeywords;
      const hasAnyMood = moods.some((mood: string) =>
        content.toLowerCase().includes(mood.toLowerCase()) ||
        content.toLowerCase().includes(mood.toLowerCase() + 's')
      );

      if (!hasAnyMood && content.length > 200) {
        issues.push(`Mood mismatch: Expected mood keywords like "${moods.join(', ')}" but not found`);
      }
    }

    if (issues.length > 0) {
      return {
        passed: false,
        severity: 'warning',
        message: `⚠️ พบความไม่สอดคล้องกับ Brand Voice`,
        suggestion: `✓ ปรับปรุง: ${issues.join('; ')}`,
        source: `Tone: ${context.toneOfVoice}, Mood: ${context.visualStyle?.moodKeywords?.join(', ')}`
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '✅ ผ่าน - เนื้อหาสอดคล้องกับ Brand Voice'
    };
  }
};

/**
 * HELPER: Calculate string similarity (simple Levenshtein-like)
 */
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
  const costs = [];
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

/**
 * MASTER GUARD: Run all checks
 */
export class DataGuardian {
  private rules: ValidationRule[] = [
    isolationGuard,
    antiCopycatGuard,
    factCheckGuard,
    uspGroundingGuard,
    referenceValidationGuard,
    consistencyCheckGuard
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
        isolation: { passed: false, severity: 'error', message: 'Pending' },
        antiCopycat: { passed: false, severity: 'error', message: 'Pending' },
        factCheck: { passed: false, severity: 'error', message: 'Pending' },
        uspGrounding: { passed: false, severity: 'error', message: 'Pending' },
        referenceValidation: { passed: false, severity: 'error', message: 'Pending' },
        consistency: { passed: false, severity: 'error', message: 'Pending' }
      },
      recommendations: [],
      overallStatus: 'passed'
    };

    // Run all checks
    for (const rule of this.rules) {
      const result = rule.check(context, content, metadata);
      (report.checks as any)[rule.id] = result;

      if (!result.passed) {
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
      `📋 Data Guard Report - ${report.timestamp}`,
      `Status: ${report.overallStatus.toUpperCase()}`,
      ``,
      `🔍 Checks Performed:`
    ];

    const checkEntries = Object.entries(report.checks) as any[];
    for (const [key, result] of checkEntries) {
      const icon = result.passed ? '✅' : result.severity === 'error' ? '❌' : '⚠️';
      lines.push(`${icon} ${result.message}`);
      if (result.source) {
        lines.push(`   └─ ${result.source}`);
      }
    }

    if (report.recommendations.length > 0) {
      lines.push(``, `💡 Recommendations:`);
      report.recommendations.forEach(rec => {
        lines.push(`   • ${rec}`);
      });
    }

    return lines.join('\n');
  }
}

export const dataGuardian = new DataGuardian();
