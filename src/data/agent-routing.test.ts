import { describe, it, expect, beforeEach } from 'vitest';
import {
  findBestRoute,
  validateAgentOutput,
  detectDuplicateWork,
  jobClassification,
  agentResponsibilities,
  type JobRequest,
  type RoutingDecision
} from './agent-routing';

describe('Agent Routing System', () => {
  describe('Job Classification', () => {
    it('should have all job types mapped', () => {
      const jobTypes = Object.keys(jobClassification);
      expect(jobTypes.length).toBe(10);
      expect(jobTypes).toContain('MARKET_ANALYSIS');
      expect(jobTypes).toContain('POSITIONING_STRATEGY');
      expect(jobTypes).toContain('CUSTOMER_INSIGHTS');
      expect(jobTypes).toContain('VISUAL_DESIGN');
      expect(jobTypes).toContain('BRAND_VOICE');
      expect(jobTypes).toContain('NARRATIVE_STORY');
      expect(jobTypes).toContain('CONTENT_STRATEGY');
      expect(jobTypes).toContain('CAMPAIGN_PLANNING');
      expect(jobTypes).toContain('AUTOMATION_SETUP');
      expect(jobTypes).toContain('ANALYTICS_MEASUREMENT');
    });

    it('should have keywords for each job type', () => {
      for (const [jobType, config] of Object.entries(jobClassification)) {
        expect(config.keywords).toBeDefined();
        expect(config.keywords.length).toBeGreaterThan(0);
        expect(config.agents).toBeDefined();
        expect(config.agents.length).toBeGreaterThan(0);
      }
    });

    it('should specify mustNotOverlapWith for each job', () => {
      for (const [, config] of Object.entries(jobClassification)) {
        expect(config.mustNotOverlapWith).toBeDefined();
        expect(Array.isArray(config.mustNotOverlapWith)).toBe(true);
      }
    });
  });

  describe('Smart Routing (findBestRoute)', () => {
    it('should route market analysis request to market-analyzer', () => {
      const request: JobRequest = {
        intent: 'analyze market opportunities',
        keywords: ['market', 'competitor', 'swot', 'analysis'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBe('market-analyzer');
      expect(decision.confidence).toBeGreaterThan(0.3);
      expect(decision.anticopycat.skipAgents).toContain('positioning-strategist');
    });

    it('should route positioning to positioning-strategist', () => {
      const request: JobRequest = {
        intent: 'define brand positioning and value proposition',
        keywords: ['positioning', 'usp', 'value', 'differentiation'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBe('positioning-strategist');
      expect(decision.confidence).toBeGreaterThan(0.2);
    });

    it('should route brand voice to brand-voice-architect', () => {
      const request: JobRequest = {
        intent: 'define brand voice and tone',
        keywords: ['tone', 'voice', 'brand', 'personality'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBe('brand-voice-architect');
      expect(decision.confidence).toBeGreaterThan(0.3);
    });

    it('should route content strategy to content-creator', () => {
      const request: JobRequest = {
        intent: 'plan caption styles',
        keywords: ['caption', 'copy', 'content', 'hook'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBe('content-creator');
      expect(decision.confidence).toBeGreaterThan(0.3);
    });

    it('should route campaign planning to campaign-planner', () => {
      const request: JobRequest = {
        intent: 'plan 30-day content campaign',
        keywords: ['campaign', 'calendar', 'schedule', '30 days'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBe('campaign-planner');
    });

    it('should include secondary agents when relevant', () => {
      const request: JobRequest = {
        intent: 'analyze market and plan positioning',
        keywords: ['market', 'competitor', 'positioning', 'value'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.secondaryAgents.length).toBeGreaterThan(0);
    });

    it('should return escalation when no match found', () => {
      const request: JobRequest = {
        intent: 'something very unclear',
        keywords: ['xyz', 'abc', 'unknown'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.confidence).toBe(0);
      expect(decision.primaryAgent).toBe('orchestrator');
      expect(decision.validationRules).toContain('ask_for_clarification');
    });

    it('should calculate confidence score between 0 and 1', () => {
      const request: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor', 'analysis'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect anti-copycat conflicts', () => {
      const request: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.anticopycat.needsDedup).toBeDefined();
      expect(decision.anticopycat.skipAgents).toBeDefined();
      expect(Array.isArray(decision.anticopycat.skipAgents)).toBe(true);
    });
  });

  describe('Output Validation', () => {
    it('should validate valid agent output', () => {
      const output = {
        task: 'market analysis',
        result: 'market gap found in segment A',
        reasoning: 'based on competitor data'
      };

      const validation = validateAgentOutput('market-analyzer', output);

      expect(validation.isValid).toBe(true);
      expect(validation.confidence).toBeGreaterThan(0.5);
    });

    it('should reject output without required fields', () => {
      const output = {
        task: 'market analysis'
        // missing result and reasoning
      };

      const validation = validateAgentOutput('market-analyzer', output);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should reject output with missing reasoning', () => {
      const output = {
        task: 'analysis',
        result: 'market analysis complete'
        // missing reasoning
      };

      const validation = validateAgentOutput('market-analyzer', output);

      expect(validation.isValid).toBe(false);
    });

    it('should reject output with missing result', () => {
      const output = {
        task: 'analysis',
        reasoning: 'based on data'
        // missing result
      };

      const validation = validateAgentOutput('market-analyzer', output);

      expect(validation.isValid).toBe(false);
    });

    it('should handle comprehensive validation', () => {
      const output = {
        task: 'market analysis',
        result: 'analysis complete',
        reasoning: 'based on data',
        swot: { strengths: [] },
        competitors: {},
        trends: [],
        confidence: 0.85,
        sources: ['market_data']
      };

      const validation = validateAgentOutput('market-analyzer', output);

      expect(validation).toBeDefined();
      expect(validation.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Duplicate Work Detection', () => {
    it('should detect duplicate work from previous outputs', () => {
      const currentRequest: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor', 'analysis'],
        masterContext: {}
      };

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            intent: 'market analysis',
            result: 'market opportunities found'
          },
          timestamp: new Date()
        }
      ];

      const result = detectDuplicateWork(currentRequest, previousOutputs);

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateAgents).toContain('market-analyzer');
    });

    it('should not detect duplicate if no previous outputs', () => {
      const currentRequest: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor'],
        masterContext: {}
      };

      const result = detectDuplicateWork(currentRequest);

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateAgents.length).toBe(0);
    });

    it('should not detect duplicate if different intent', () => {
      const currentRequest: JobRequest = {
        intent: 'positioning strategy',
        keywords: ['positioning', 'value'],
        masterContext: {}
      };

      const previousOutputs = [
        {
          agentId: 'market-analyzer',
          output: {
            intent: 'market analysis',
            result: 'market analysis done'
          },
          timestamp: new Date()
        }
      ];

      const result = detectDuplicateWork(currentRequest, previousOutputs);

      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Agent Responsibilities', () => {
    it('should define responsibilities for all 10 agents', () => {
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
        expect(agentResponsibilities[agentId]).toBeDefined();
        const resp = agentResponsibilities[agentId];
        expect(resp.primary.length).toBeGreaterThan(0);
        expect(resp.canCollaborate).toBeDefined();
        expect(resp.cannotDo).toBeDefined();
      }
    });

    it('should not allow responsible agents to do conflicting tasks', () => {
      const marketAnalyzer = agentResponsibilities['market-analyzer'];

      expect(marketAnalyzer.cannotDo).toContain('Positioning Strategy');
      expect(marketAnalyzer.cannotDo).toContain('Design');
      expect(marketAnalyzer.cannotDo).toContain('Content Creation');
    });

    it('should define collaboration relationships', () => {
      const positioningStrategist = agentResponsibilities['positioning-strategist'];

      expect(positioningStrategist.canCollaborate).toContain('market-analyzer');
      expect(positioningStrategist.canCollaborate).toContain('customer-insight-specialist');
    });
  });

  describe('Routing Decision Output', () => {
    it('should return RoutingDecision with all required fields', () => {
      const request: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.primaryAgent).toBeDefined();
      expect(decision.secondaryAgents).toBeDefined();
      expect(Array.isArray(decision.secondaryAgents)).toBe(true);
      expect(decision.confidence).toBeDefined();
      expect(decision.reasoning).toBeDefined();
      expect(decision.validationRules).toBeDefined();
      expect(decision.anticopycat).toBeDefined();
      expect(decision.anticopycat.needsDedup).toBeDefined();
      expect(decision.anticopycat.skipAgents).toBeDefined();
    });

    it('should not have duplicate secondary agents', () => {
      const request: JobRequest = {
        intent: 'market and positioning analysis',
        keywords: ['market', 'competitor', 'positioning', 'value', 'usp'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      const uniqueAgents = new Set(decision.secondaryAgents);
      expect(uniqueAgents.size).toBe(decision.secondaryAgents.length);
    });

    it('should not include primaryAgent in secondaryAgents', () => {
      const request: JobRequest = {
        intent: 'market analysis',
        keywords: ['market', 'competitor', 'analysis'],
        masterContext: {}
      };

      const decision = findBestRoute(request);

      expect(decision.secondaryAgents).not.toContain(decision.primaryAgent);
    });
  });
});
