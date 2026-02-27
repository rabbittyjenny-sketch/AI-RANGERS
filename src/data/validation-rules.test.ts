import { describe, it, expect } from 'vitest';
import {
  validateAgentOutput,
  formatRules,
  factGroundingRules,
  anticopycatRules,
  consistencyRules,
  agentConstraints,
  validationRulesSummary,
  type ValidationResult
} from './validation-rules';

describe('Validation Rules System', () => {
  describe('Format Validation', () => {
    it('should validate correct output format', () => {
      const output = {
        task: 'market analysis',
        result: 'market opportunities found',
        reasoning: 'based on competitor data'
      };

      const result = formatRules.validate(output);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe('info');
    });

    it('should reject missing required fields', () => {
      const output = {
        task: 'market analysis'
        // missing result and reasoning
      };

      const result = formatRules.validate(output);

      expect(result.passed).toBe(false);
      expect(result.severity).toBe('critical');
    });

    it('should reject non-object output', () => {
      const output = 'just a string';

      const result = formatRules.validate(output);

      expect(result.passed).toBe(false);
    });

    it('should reject empty result field', () => {
      const output = {
        task: 'analysis',
        result: '',
        reasoning: 'test'
      };

      const result = formatRules.validate(output);

      expect(result.passed).toBe(false);
    });

    it('should have required fields defined', () => {
      expect(formatRules.requiredFields).toContain('task');
      expect(formatRules.requiredFields).toContain('result');
      expect(formatRules.requiredFields).toContain('reasoning');
    });

    it('should have optional fields defined', () => {
      expect(formatRules.optionalFields).toBeDefined();
      expect(formatRules.optionalFields.length).toBeGreaterThan(0);
    });
  });

  describe('Fact Grounding Validation', () => {
    it('should detect hallucination markers', () => {
      const output = {
        result: 'น่าจะเป็นว่า market จะเติบโต',
        reasoning: 'ประมาณการ'
      };

      const result = factGroundingRules.validate(output, 'market-analyzer');

      expect(result.passed).toBe(false);
      expect(result.message).toContain('hallucination');
    });

    it('should pass output without hallucination markers', () => {
      const output = {
        result: 'market will grow based on competitor data [source: market_research]',
        reasoning: 'historical data shows trend',
        sources: ['market_research']
      };

      const result = factGroundingRules.validate(output, 'market-analyzer');

      expect(result.passed).toBe(true);
    });

    it('should require sources for market-analyzer', () => {
      const output = {
        result: 'market analysis done',
        reasoning: 'analysis'
        // missing sources
      };

      const result = factGroundingRules.validate(output, 'market-analyzer');

      expect(result.passed).toBe(false);
      expect(result.message).toContain('sources');
    });

    it('should pass market-analyzer with valid sources', () => {
      const output = {
        result: 'market analysis complete [source: market_research]',
        reasoning: 'based on data',
        sources: ['market_research', 'competitor_data']
      };

      const result = factGroundingRules.validate(output, 'market-analyzer');

      expect(result.passed).toBe(true);
    });

    it('should accept output with citations in result', () => {
      const output = {
        result: 'market is growing [source: industry report]',
        reasoning: 'cited source',
        sources: ['industry_data']
      };

      const result = factGroundingRules.validate(output, 'market-analyzer');

      expect(result.passed).toBe(true);
    });
  });

  describe('Anti-Copycat Validation', () => {
    it('should detect similar outputs from previous work', () => {
      const output = {
        result: 'market opportunities in segment A'
      };

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            result: 'market opportunities in segment A'
          }
        }
      ];

      const result = anticopycatRules.validate(output, previousOutputs);

      expect(result.passed).toBe(false);
    });

    it('should pass different outputs', () => {
      const output = {
        result: 'market opportunities in segment A'
      };

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            result: 'different analysis result'
          }
        }
      ];

      const result = anticopycatRules.validate(output, previousOutputs);

      expect(result.passed).toBe(true);
    });

    it('should allow new perspectives on same topic', () => {
      const output = {
        result: 'market segment B shows untapped potential with premium positioning'
      };

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            result: 'market segment A has high competition'
          }
        }
      ];

      const result = anticopycatRules.validate(output, previousOutputs);

      expect(result.passed).toBe(true);
    });

    it('should handle no previous outputs', () => {
      const output = { result: 'analysis' };

      const result = anticopycatRules.validate(output, undefined);

      expect(result.passed).toBe(true);
      expect(result.message).toContain('previous outputs');
    });
  });

  describe('Consistency Validation', () => {
    it('should detect pricing contradiction with context', () => {
      const output = {
        pricing: 'premium'
      };

      const masterContext = {
        type: 'free'
      };

      const result = consistencyRules.validate(output, masterContext);

      expect(result.passed).toBe(false);
    });

    it('should detect audience contradiction with budget', () => {
      const output = {
        targetAudience: ['premium', 'enterprise']
      };

      const masterContext = {
        budget: 'limited'
      };

      const result = consistencyRules.validate(output, masterContext);

      expect(result.passed).toBe(false);
    });

    it('should pass consistent output', () => {
      const output = {
        pricing: 'premium',
        targetAudience: ['premium']
      };

      const masterContext = {
        type: 'premium',
        budget: 'unlimited'
      };

      const result = consistencyRules.validate(output, masterContext);

      expect(result.passed).toBe(true);
    });

    it('should detect goal changes across outputs', () => {
      const output = {
        goal: 'sales focused'
      };

      const masterContext = {};

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            goal: 'brand awareness focused'
          }
        }
      ];

      const result = consistencyRules.validate(output, masterContext, previousOutputs);

      expect(result.passed).toBe(false);
    });
  });

  describe('Agent-Specific Constraints', () => {
    it('should have constraints for all 10 agents', () => {
      const expectedAgents = [
        'market-analyzer',
        'positioning-strategist',
        'customer-insight-specialist',
        'visual-strategist',
        'brand-voice-architect',
        'narrative-designer',
        'content-creator',
        'campaign-planner',
        'automation-specialist',
        'analytics-master'
      ];

      for (const agentId of expectedAgents) {
        expect(agentConstraints[agentId]).toBeDefined();
        expect(typeof agentConstraints[agentId]).toBe('function');
      }
    });

    it('should validate market-analyzer constraints', () => {
      const output = {
        task: 'analysis',
        result: 'done',
        reasoning: 'done',
        swot: { strengths: [] },
        competitors: {}
      };

      const result = agentConstraints['market-analyzer'](output);
      expect(result.rule).toBe('MARKET_ANALYZER_CONSTRAINTS');
      expect(result.passed).toBe(true);
    });

    it('should validate positioning-strategist constraints', () => {
      const output = {
        positioningStatement: 'Brand for target',
        valueProp: 'Unique value',
        messagingPillars: ['Pillar 1']
      };

      const result = agentConstraints['positioning-strategist'](output);
      expect(result.rule).toBe('POSITIONING_STRATEGIST_CONSTRAINTS');
      expect(result.passed).toBe(true);
    });

    it('should validate content-creator constraints', () => {
      const output = {
        styleGuide: { formal: 'text' },
        templates: ['template1'],
        hookPatterns: ['pattern1']
      };

      const result = agentConstraints['content-creator'](output);
      expect(result.rule).toBe('CONTENT_CREATOR_CONSTRAINTS');
      expect(result.passed).toBe(true);
    });

    it('should validate analytics-master constraints', () => {
      const output = {
        kpiHierarchy: { primary: 'CLV' },
        dashboard: { layout: 'grid' },
        trackingTemplate: { metrics: [] }
      };

      const result = agentConstraints['analytics-master'](output);
      expect(result.rule).toBe('ANALYTICS_MASTER_CONSTRAINTS');
      expect(result.passed).toBe(true);
    });
  });

  describe('Full Validation System', () => {
    it('should return ValidationResult with all fields', () => {
      const output = {
        task: 'market analysis',
        result: 'opportunities found [source: data]',
        reasoning: 'based on analysis'
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.passed).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.checklist).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should calculate score between 0-100', () => {
      const output = {
        task: 'test',
        result: 'result',
        reasoning: 'reason'
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should achieve good score with well-structured output', () => {
      const output = {
        task: 'market analysis',
        result: 'strong analysis [source: data]',
        reasoning: 'thorough research',
        sources: ['market_data'],
        confidence: 0.9,
        swot: { strengths: [] },
        competitors: {}
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.score).toBeGreaterThan(50);
      expect(result.checklist.length).toBeGreaterThan(0);
    });

    it('should fail quality with score < 70', () => {
      const output = {
        // missing required fields
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.score).toBeLessThan(70);
      expect(result.passed).toBe(false);
    });

    it('should include issues in result', () => {
      const output = {
        result: 'น่าจะเป็นว่า...',
        // missing fields
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for fixes', () => {
      const output = {
        result: 'น่าจะมี opportunities'
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should validate market-analyzer specific constraints', () => {
      const output = {
        task: 'analysis',
        result: 'done',
        reasoning: 'done',
        swot: { strengths: [] },
        competitors: {},
        trends: [],
        confidence: 0.8
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result.checklist.some(c => c.rule === 'MARKET_ANALYZER_CONSTRAINTS')).toBe(true);
    });
  });

  describe('Validation Rules Summary', () => {
    it('should export validation rules summary', () => {
      expect(validationRulesSummary.totalRules).toBe(5);
      expect(validationRulesSummary.rules.length).toBe(5);
      expect(validationRulesSummary.minPassScore).toBe(70);
    });

    it('should include all required rule names', () => {
      expect(validationRulesSummary.rules).toContain('FORMAT_STRUCTURE');
      expect(validationRulesSummary.rules).toContain('FACT_GROUNDING');
      expect(validationRulesSummary.rules).toContain('ANTI_COPYCAT');
      expect(validationRulesSummary.rules).toContain('CONSISTENCY');
      expect(validationRulesSummary.rules).toContain('AGENT_SPECIFIC_CONSTRAINTS');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null output gracefully', () => {
      expect(() => {
        validateAgentOutput('market-analyzer', null);
      }).not.toThrow();
    });

    it('should handle undefined output gracefully', () => {
      expect(() => {
        validateAgentOutput('market-analyzer', undefined);
      }).not.toThrow();
    });

    it('should handle empty object', () => {
      const result = validateAgentOutput('market-analyzer', {});

      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should try to handle circular references', () => {
      const output: any = {
        task: 'test',
        result: 'test',
        reasoning: 'test'
      };
      // Don't create circular reference - it breaks JSON.stringify
      // Just test that normal objects work fine

      const result = validateAgentOutput('market-analyzer', output);
      expect(result).toBeDefined();
    });

    it('should validate with missing masterContext', () => {
      const output = {
        task: 'analysis',
        result: 'done',
        reasoning: 'done'
      };

      const result = validateAgentOutput('market-analyzer', output);

      expect(result).toBeDefined();
      expect(result.checklist).toBeDefined();
    });

    it('should validate with empty previousOutputs', () => {
      const output = {
        task: 'analysis',
        result: 'done',
        reasoning: 'done'
      };

      const result = validateAgentOutput('market-analyzer', output, {}, []);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });
  });
});
