/**
 * Agent Output Validation Rules
 * Quality Checks + Fact Grounding + Anti-Copycat + Consistency
 */

export interface ValidationResult {
  passed: boolean;
  score: number; // 0-100
  checklist: CheckResult[];
  issues: ValidationIssue[];
  recommendations: string[];
  timestamp: Date;
}

export interface CheckResult {
  rule: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface ValidationIssue {
  category: 'format' | 'content' | 'fact' | 'consistency' | 'conflict';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

/**
 * RULE 1: Output Format Validation
 * ตรวจว่า Output มี structure ที่ถูกต้อง
 */
export const formatRules = {
  requiredFields: ['task', 'result', 'reasoning'],
  optionalFields: ['confidence', 'sources', 'next_steps', 'timestamp'],

  validate: (output: any): CheckResult => {
    const issues: string[] = [];

    // Check required fields
    for (const field of formatRules.requiredFields) {
      if (!output || !output[field]) {
        issues.push(`ไม่พบ required field: "${field}"`);
      }
    }

    // Check data types
    if (output && typeof output !== 'object') {
      issues.push(`Output ต้องเป็น Object, ได้รับ ${typeof output}`);
    }

    if (output?.result && typeof output.result === 'string' && output.result.length === 0) {
      issues.push('Result ไม่ควรเป็นค่าว่าง');
    }

    return {
      rule: 'FORMAT_STRUCTURE',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'critical' : 'info',
      message:
        issues.length === 0 ? 'Format ถูกต้อง' : issues.join('; ')
    };
  }
};

/**
 * RULE 2: Fact Grounding Validation
 * ตรวจว่า Output อิงข้อมูลจริง ไม่ Hallucinate
 */
export const factGroundingRules = {
  hallucMarkers: [
    'ฉันประมาณ',
    'น่าจะ',
    'อาจจะ',
    'สมมุติว่า',
    'ถ้าหาก',
    'เหมือนว่า',
    'อาจเป็นไปได้',
    'อนุมาน',
    'ตามลำดับ',
    'คิดว่า',
    'ประมาณการ'
  ],

  validate: (output: any, agentId: string): CheckResult => {
    const issues: string[] = [];

    // Guard against null/undefined
    if (!output || typeof output !== 'object') {
      return {
        rule: 'FACT_GROUNDING',
        passed: false,
        severity: 'critical',
        message: 'Output must be a valid object'
      };
    }

    // Check for hallucination markers
    try {
      const content = JSON.stringify(output).toLowerCase();
      const foundMarkers = factGroundingRules.hallucMarkers.filter(m =>
        content.includes(m.toLowerCase())
      );

      if (foundMarkers.length > 0) {
        issues.push(`พบ hallucination markers: ${foundMarkers.join(', ')}`);
      }
    } catch (e) {
      // Ignore stringify errors (circular refs, etc)
    }

    // Check citations (looser requirement)
    if (output?.result && typeof output.result === 'string') {
      const citationPattern = /\[.*?\]|\(source:.*?\)|source:/i;
      if (!citationPattern.test(output.result) && !output.sources) {
        issues.push('ควรมี citations หรือ sources');
      }
    }

    return {
      rule: 'FACT_GROUNDING',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'Fact grounding ดี' : issues.join('; ')
    };
  }
};

/**
 * RULE 3: Anti-Copycat Validation
 * ตรวจว่า Output ไม่เลียนแบบงานเก่า
 */
export const anticopycatRules = {
  validate: (
    output: any,
    previousOutputs?: { agentId: string; output: any }[]
  ): CheckResult => {
    const issues: string[] = [];

    if (!previousOutputs || previousOutputs.length === 0) {
      return {
        rule: 'ANTI_COPYCAT',
        passed: true,
        severity: 'info',
        message: 'ไม่มี previous outputs ให้เปรียบเทียบ'
      };
    }

    // ตรวจ Similarity ของ output
    const currentResult = JSON.stringify(output.result || '').toLowerCase();

    for (const prev of previousOutputs) {
      const prevResult = JSON.stringify(prev.output.result || '').toLowerCase();

      // Simple similarity check (ควรใช้ algorithm ที่ซับซ้อนมากกว่า)
      const similarity = calculateSimilarity(currentResult, prevResult);

      if (similarity > 0.8) {
        issues.push(`Output คล้ายกับ output เก่าจาก ${prev.agentId} (Similarity: ${similarity.toFixed(2)})`);
      }
    }

    return {
      rule: 'ANTI_COPYCAT',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ไม่ค้นพบการเลียนแบบ' : issues.join('; ')
    };
  }
};

/**
 * RULE 4: Consistency Validation
 * ตรวจว่า Output ไม่ขัดกับ Master Context หรือ output เก่า
 */
export const consistencyRules = {
  validate: (
    output: any,
    masterContext: any,
    previousOutputs?: { agentId: string; output: any }[]
  ): CheckResult => {
    const issues: string[] = [];

    // Check 1: Consistency with master context
    if (masterContext) {
      // ถ้า output บอก price แต่ master context บอก free → conflict
      if (
        output.pricing === 'premium' &&
        masterContext.type === 'free'
      ) {
        issues.push('Output pricing ขัดกับ master context');
      }

      // ถ้า output บอก target premium แต่ master context บอก budget = conflict
      if (
        output.targetAudience?.includes('premium') &&
        masterContext.budget === 'limited'
      ) {
        issues.push('Target audience ไม่สอดคล้องกับ budget');
      }
    }

    // Check 2: Cross-output consistency
    if (previousOutputs && previousOutputs.length > 0) {
      // ตรวจ contradiction กับ output ก่อนหน้า
      const prevGoal = previousOutputs[0].output?.goal;
      const currentGoal = output?.goal;

      if (prevGoal && currentGoal && prevGoal !== currentGoal) {
        issues.push(`Goal เปลี่ยนจาก "${prevGoal}" เป็น "${currentGoal}"`);
      }
    }

    return {
      rule: 'CONSISTENCY',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'Consistency ดี' : issues.join('; ')
    };
  }
};

/**
 * RULE 5: Agent-Specific Constraints
 * ตรวจว่า Output ตรงตามเงื่อนไข Agent นั้น ๆ
 */
export const agentConstraints: {
  [agentId: string]: (output: any) => CheckResult;
} = {
  'market-analyzer': (output) => {
    const issues: string[] = [];

    if (!output || typeof output !== 'object') {
      return {
        rule: 'MARKET_ANALYZER_CONSTRAINTS',
        passed: false,
        severity: 'critical',
        message: 'Invalid output'
      };
    }

    // Soft requirements for constraints
    if (!output.swot) issues.push('ต้องมี SWOT Analysis');
    if (!output.competitors) issues.push('ต้องมี Competitor Analysis');

    return {
      rule: 'MARKET_ANALYZER_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'info' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'positioning-strategist': (output) => {
    const issues: string[] = [];

    if (!output.positioningStatement) issues.push('ต้องมี Positioning Statement');
    if (!output.valueProp) issues.push('ต้องมี Value Proposition');
    if (!output.messagingPillars) issues.push('ต้องมี Messaging Pillars');

    return {
      rule: 'POSITIONING_STRATEGIST_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'customer-insight-specialist': (output) => {
    const issues: string[] = [];

    if (!output.journeyMap) issues.push('ต้องมี Journey Map');
    if (!output.personas) issues.push('ต้องมี Personas');
    if (!output.painPoints) issues.push('ต้องมี Pain Points');

    return {
      rule: 'CUSTOMER_INSIGHT_SPECIALIST_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'visual-strategist': (output) => {
    const issues: string[] = [];

    if (!output.colorPalette) issues.push('ต้องมี Color Palette');
    if (!output.typography) issues.push('ต้องมี Typography');
    if (!output.visualSystem) issues.push('ต้องมี Visual System');

    return {
      rule: 'VISUAL_STRATEGIST_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'brand-voice-architect': (output) => {
    const issues: string[] = [];

    if (!output.toneMatrix) issues.push('ต้องมี Tone Matrix');
    if (!output.voicePersonality) issues.push('ต้องมี Voice Personality');
    if (!output.communicationRules) issues.push('ต้องมี Communication Rules');

    return {
      rule: 'BRAND_VOICE_ARCHITECT_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'narrative-designer': (output) => {
    const issues: string[] = [];

    if (!output.storyArc) issues.push('ต้องมี Story Arc');
    if (!output.heroJourney) issues.push('ต้องมี Hero Journey');
    if (!output.narrativePatterns) issues.push('ต้องมี Narrative Patterns');

    return {
      rule: 'NARRATIVE_DESIGNER_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'content-creator': (output) => {
    const issues: string[] = [];

    if (!output.styleGuide) issues.push('ต้องมี Style Guide');
    if (!output.templates) issues.push('ต้องมี Templates');
    if (!output.hookPatterns) issues.push('ต้องมี Hook Patterns');

    return {
      rule: 'CONTENT_CREATOR_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'campaign-planner': (output) => {
    const issues: string[] = [];

    if (!output.contentCalendar) issues.push('ต้องมี Content Calendar');
    if (!output.contentMix) issues.push('ต้องมี Content Mix');
    if (
      output.contentCalendar &&
      !output.contentCalendar.every((d: any) => d.date && d.content)
    ) {
      issues.push('Content Calendar ต้องมี date และ content');
    }

    return {
      rule: 'CAMPAIGN_PLANNER_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'automation-specialist': (output) => {
    const issues: string[] = [];

    if (!output.workflows) issues.push('ต้องมี Workflows');
    if (!output.toolIntegration) issues.push('ต้องมี Tool Integration');
    if (!output.triggers) issues.push('ต้องมี Triggers');

    return {
      rule: 'AUTOMATION_SPECIALIST_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  },

  'analytics-master': (output) => {
    const issues: string[] = [];

    if (!output.kpiHierarchy) issues.push('ต้องมี KPI Hierarchy');
    if (!output.dashboard) issues.push('ต้องมี Dashboard');
    if (!output.trackingTemplate) issues.push('ต้องมี Tracking Template');

    return {
      rule: 'ANALYTICS_MASTER_CONSTRAINTS',
      passed: issues.length === 0,
      severity: issues.length > 0 ? 'warning' : 'info',
      message: issues.length === 0 ? 'ครบ constraints' : issues.join('; ')
    };
  }
};

/**
 * Main Validation Function
 */
export function validateAgentOutput(
  agentId: string,
  output: any,
  masterContext?: any,
  previousOutputs?: { agentId: string; output: any }[]
): ValidationResult {
  const checklist: CheckResult[] = [];
  const issues: ValidationIssue[] = [];
  let score = 100;

  // Rule 1: Format
  const formatCheck = formatRules.validate(output);
  checklist.push(formatCheck);
  if (!formatCheck.passed) {
    score -= 30;
    issues.push({
      category: 'format',
      severity: 'critical',
      message: formatCheck.message,
      suggestion: 'ตรวจ required fields และ data types'
    });
  }

  // Rule 2: Fact Grounding
  const factCheck = factGroundingRules.validate(output, agentId);
  checklist.push(factCheck);
  if (!factCheck.passed) {
    score -= 20;
    issues.push({
      category: 'fact',
      severity: 'critical',
      message: factCheck.message,
      suggestion: 'ลบ hallucination markers และ เพิ่ม sources/citations'
    });
  }

  // Rule 3: Anti-Copycat
  const anticopycatCheck = anticopycatRules.validate(output, previousOutputs);
  checklist.push(anticopycatCheck);
  if (!anticopycatCheck.passed) {
    score -= 15;
    issues.push({
      category: 'conflict',
      severity: 'warning',
      message: anticopycatCheck.message,
      suggestion: 'เพิ่มข้อมูลใหม่ หรือ unique perspectives'
    });
  }

  // Rule 4: Consistency
  const consistencyCheck = consistencyRules.validate(output, masterContext, previousOutputs);
  checklist.push(consistencyCheck);
  if (!consistencyCheck.passed) {
    score -= 15;
    issues.push({
      category: 'consistency',
      severity: 'warning',
      message: consistencyCheck.message,
      suggestion: 'ตรวจ master context และ previous outputs'
    });
  }

  // Rule 5: Agent-Specific Constraints
  if (agentConstraints[agentId]) {
    const agentCheck = agentConstraints[agentId](output);
    checklist.push(agentCheck);
    if (!agentCheck.passed) {
      score -= 20;
      issues.push({
        category: 'content',
        severity: 'warning',
        message: agentCheck.message,
        suggestion: 'เพิ่ม required fields ตามเงื่อนไขของ Agent นี้'
      });
    }
  }

  return {
    passed: score >= 70,
    score: Math.max(0, score),
    checklist,
    issues,
    recommendations: issues.map(i => i.suggestion),
    timestamp: new Date()
  };
}

/**
 * Utility: Calculate Similarity
 * Simple string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

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
 * Export Summary
 */
export const validationRulesSummary = {
  totalRules: 5,
  rules: [
    'FORMAT_STRUCTURE',
    'FACT_GROUNDING',
    'ANTI_COPYCAT',
    'CONSISTENCY',
    'AGENT_SPECIFIC_CONSTRAINTS'
  ],
  minPassScore: 70,
  description: 'Comprehensive validation system for Agent outputs'
};
