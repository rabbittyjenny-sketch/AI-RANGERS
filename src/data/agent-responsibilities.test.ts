import { describe, it, expect } from 'vitest';
import {
  getWorkflowOrder,
  validateDependencies,
  responsibilityMatrices,
  type ResponsibilityMatrix
} from './agent-responsibilities';

describe('Agent Responsibilities & Workflow', () => {
  describe('Responsibility Matrices', () => {
    it('should have defined matrices for all 10 agents', () => {
      const agentIds = [
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

      for (const agentId of agentIds) {
        const matrix = responsibilityMatrices.find(m => m.agentId === agentId);
        expect(matrix).toBeDefined();
        expect(matrix?.agentId).toBe(agentId);
      }
    });

    it('should have all required fields in each matrix', () => {
      for (const matrix of responsibilityMatrices) {
        expect(matrix.agentId).toBeDefined();
        expect(matrix.agentName).toBeDefined();
        expect(matrix.cluster).toBeDefined();
        expect(['strategy', 'creative', 'growth']).toContain(matrix.cluster);

        expect(matrix.primaryResponsibilities).toBeDefined();
        expect(Array.isArray(matrix.primaryResponsibilities)).toBe(true);
        expect(matrix.primaryResponsibilities.length).toBeGreaterThan(0);

        expect(matrix.dependsOn).toBeDefined();
        expect(Array.isArray(matrix.dependsOn)).toBe(true);

        expect(matrix.requiredBy).toBeDefined();
        expect(Array.isArray(matrix.requiredBy)).toBe(true);

        expect(matrix.conflictsWith).toBeDefined();
        expect(Array.isArray(matrix.conflictsWith)).toBe(true);

        expect([1, 2, 3]).toContain(matrix.executionPhase);
        expect(matrix.requiredInputs).toBeDefined();
        expect(matrix.expectedOutputs).toBeDefined();
        expect(matrix.successCriteria).toBeDefined();
      }
    });

    it('should have clear cluster assignments', () => {
      const strategyAgents = responsibilityMatrices.filter(
        m => m.cluster === 'strategy'
      );
      const creativeAgents = responsibilityMatrices.filter(
        m => m.cluster === 'creative'
      );
      const growthAgents = responsibilityMatrices.filter(
        m => m.cluster === 'growth'
      );

      expect(strategyAgents.length).toBe(3); // market-analyzer, positioning-strategist, customer-insight-specialist
      expect(creativeAgents.length).toBe(3); // visual-strategist, brand-voice-architect, narrative-designer
      expect(growthAgents.length).toBe(4); // content-creator, campaign-planner, automation-specialist, analytics-master
    });
  });

  describe('Workflow Phases', () => {
    it('should organize agents into 3 phases', () => {
      const phases = getWorkflowOrder();

      expect(phases.length).toBe(3);
      expect(phases[0]).toBeDefined(); // Phase 1: Strategy
      expect(phases[1]).toBeDefined(); // Phase 2: Creative
      expect(phases[2]).toBeDefined(); // Phase 3: Growth
    });

    it('should have Strategy agents in Phase 1', () => {
      const phases = getWorkflowOrder();
      const phase1 = phases[0];

      expect(phase1).toContain('market-analyzer');
      expect(phase1).toContain('positioning-strategist');
      expect(phase1).toContain('customer-insight-specialist');
    });

    it('should have Creative agents in Phase 2', () => {
      const phases = getWorkflowOrder();
      const phase2 = phases[1];

      expect(phase2).toContain('visual-strategist');
      expect(phase2).toContain('brand-voice-architect');
      expect(phase2).toContain('narrative-designer');
    });

    it('should have Growth agents in Phase 3', () => {
      const phases = getWorkflowOrder();
      const phase3 = phases[2];

      expect(phase3).toContain('content-creator');
      expect(phase3).toContain('campaign-planner');
      expect(phase3).toContain('automation-specialist');
      expect(phase3).toContain('analytics-master');
    });

    it('should not have overlapping agents across phases', () => {
      const phases = getWorkflowOrder();
      const allAgents = phases.flat();
      const uniqueAgents = new Set(allAgents);

      expect(allAgents.length).toBe(uniqueAgents.size);
    });
  });

  describe('Dependency Management', () => {
    it('should identify market-analyzer as first (no dependencies)', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );

      expect(marketAnalyzer?.dependsOn.length).toBe(0);
    });

    it('should show positioning-strategist depends on market-analyzer', () => {
      const positioningStrategist = responsibilityMatrices.find(
        m => m.agentId === 'positioning-strategist'
      );

      expect(positioningStrategist?.dependsOn.length).toBeGreaterThan(0);
      expect(positioningStrategist?.dependsOn[0].agentId).toBe('market-analyzer');
    });

    it('should show visual-strategist depends on market-analyzer and positioning-strategist', () => {
      const visualStrategist = responsibilityMatrices.find(
        m => m.agentId === 'visual-strategist'
      );

      const dependsOnIds = visualStrategist?.dependsOn.map(d => d.agentId) || [];

      expect(dependsOnIds).toContain('market-analyzer');
      expect(dependsOnIds).toContain('positioning-strategist');
    });

    it('should show brand-voice-architect depends on positioning-strategist and visual-strategist', () => {
      const brandVoice = responsibilityMatrices.find(
        m => m.agentId === 'brand-voice-architect'
      );

      const dependsOnIds = brandVoice?.dependsOn.map(d => d.agentId) || [];

      expect(dependsOnIds).toContain('positioning-strategist');
      expect(dependsOnIds).toContain('visual-strategist');
    });

    it('should show campaign-planner depends on multiple agents', () => {
      const campaignPlanner = responsibilityMatrices.find(
        m => m.agentId === 'campaign-planner'
      );

      expect(campaignPlanner?.dependsOn.length).toBe(2);
    });

    it('should show automation-specialist depends on campaign-planner', () => {
      const automationSpecialist = responsibilityMatrices.find(
        m => m.agentId === 'automation-specialist'
      );

      const dependsOnIds = automationSpecialist?.dependsOn.map(d => d.agentId) || [];

      expect(dependsOnIds).toContain('campaign-planner');
    });

    it('should have bidirectional dependency links', () => {
      for (const matrix of responsibilityMatrices) {
        for (const dep of matrix.dependsOn) {
          const depMatrix = responsibilityMatrices.find(m => m.agentId === dep.agentId);
          expect(depMatrix).toBeDefined();
          const requiredByIds = depMatrix?.requiredBy.map(r => r.agentId) || [];
          expect(requiredByIds).toContain(matrix.agentId);
        }
      }
    });

    it('should have bidirectional requiredBy links', () => {
      for (const matrix of responsibilityMatrices) {
        for (const req of matrix.requiredBy) {
          const reqMatrix = responsibilityMatrices.find(m => m.agentId === req.agentId);
          expect(reqMatrix).toBeDefined();
          const dependsOnIds = reqMatrix?.dependsOn.map(d => d.agentId) || [];
          expect(dependsOnIds).toContain(matrix.agentId);
        }
      }
    });
  });

  describe('Conflict Detection', () => {
    it('should define conflicts for each agent', () => {
      for (const matrix of responsibilityMatrices) {
        expect(matrix.conflictsWith).toBeDefined();
        expect(Array.isArray(matrix.conflictsWith)).toBe(true);
      }
    });

    it('should show market-analyzer conflicts with analytics-master', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );

      const conflictIds = marketAnalyzer?.conflictsWith.map(c => c.agentId) || [];

      expect(conflictIds).toContain('analytics-master');
    });

    it('should specify reason for each conflict', () => {
      for (const matrix of responsibilityMatrices) {
        for (const conflict of matrix.conflictsWith) {
          expect(conflict.reason).toBeDefined();
          expect(conflict.reason.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('validateDependencies Function', () => {
    it('should return ready=true when no dependencies', () => {
      const result = validateDependencies('market-analyzer', []);

      expect(result.isReady).toBe(true);
      expect(result.missingDependencies.length).toBe(0);
    });

    it('should return ready=false when dependencies not completed', () => {
      const result = validateDependencies('positioning-strategist', []);

      expect(result.isReady).toBe(false);
      expect(result.missingDependencies).toContain('market-analyzer');
    });

    it('should return ready=true when all dependencies completed', () => {
      const result = validateDependencies('positioning-strategist', ['market-analyzer']);

      expect(result.isReady).toBe(true);
      expect(result.missingDependencies.length).toBe(0);
    });

    it('should list all missing dependencies', () => {
      const result = validateDependencies('campaign-planner', ['market-analyzer']);

      expect(result.isReady).toBe(false);
      expect(result.missingDependencies.length).toBeGreaterThan(0);
    });

    it('should return false for non-existent agent', () => {
      const result = validateDependencies('non-existent-agent', []);

      expect(result.isReady).toBe(false);
      expect(result.missingDependencies).toContain('non-existent-agent');
    });

    it('should validate full Phase 3 readiness with Phase 1 + 2 completed', () => {
      const completedPhase1And2 = [
        'market-analyzer', 'positioning-strategist', 'customer-insight-specialist',
        'visual-strategist', 'brand-voice-architect', 'narrative-designer'
      ];

      const contentCreatorResult = validateDependencies('content-creator', completedPhase1And2);
      expect(contentCreatorResult.isReady).toBe(true);
    });
  });

  describe('Output Requirements', () => {
    it('should specify required inputs for each agent', () => {
      for (const matrix of responsibilityMatrices) {
        expect(matrix.requiredInputs.length).toBeGreaterThan(0);
      }
    });

    it('should specify expected outputs for each agent', () => {
      for (const matrix of responsibilityMatrices) {
        expect(matrix.expectedOutputs.length).toBeGreaterThan(0);
      }
    });

    it('should define success criteria for each agent', () => {
      for (const matrix of responsibilityMatrices) {
        expect(matrix.successCriteria.length).toBeGreaterThan(0);
      }
    });

    it('market-analyzer should require specific inputs', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );

      expect(marketAnalyzer?.requiredInputs).toContain('Master Context (Product Info)');
      expect(marketAnalyzer?.requiredInputs).toContain('Business Goals');
    });

    it('market-analyzer should produce specific outputs', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );

      const outputs = marketAnalyzer?.expectedOutputs || [];

      expect(outputs.some(o => o.includes('SWOT'))).toBe(true);
      expect(outputs.some(o => o.includes('Competitor'))).toBe(true);
    });

    it('positioning-strategist should have different outputs than market-analyzer', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );
      const positioningStrategist = responsibilityMatrices.find(
        m => m.agentId === 'positioning-strategist'
      );

      const analyzerOutputs = new Set(marketAnalyzer?.expectedOutputs || []);
      const strategistOutputs = new Set(positioningStrategist?.expectedOutputs || []);

      const intersection = Array.from(analyzerOutputs).filter(o =>
        strategistOutputs.has(o)
      );

      expect(intersection.length).toBe(0);
    });
  });

  describe('Cross-Team Collaboration', () => {
    it('should show strategy outputs required by creative agents', () => {
      const marketAnalyzer = responsibilityMatrices.find(
        m => m.agentId === 'market-analyzer'
      );

      const requiredByIds = marketAnalyzer?.requiredBy.map(r => r.agentId) || [];

      expect(requiredByIds).toContain('visual-strategist');
    });

    it('should show creative outputs required by growth agents', () => {
      const brandVoice = responsibilityMatrices.find(
        m => m.agentId === 'brand-voice-architect'
      );

      const requiredByIds = brandVoice?.requiredBy.map(r => r.agentId) || [];

      expect(requiredByIds).toContain('content-creator');
    });

    it('should specify reason for each required-by relationship', () => {
      for (const matrix of responsibilityMatrices) {
        for (const required of matrix.requiredBy) {
          expect(required.reason).toBeDefined();
          expect(required.reason.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Phase Sequencing', () => {
    it('should have Strategy in Phase 1', () => {
      const strategyAgents = responsibilityMatrices.filter(
        m => m.cluster === 'strategy'
      );

      for (const agent of strategyAgents) {
        expect(agent.executionPhase).toBe(1);
      }
    });

    it('should have Creative in Phase 2', () => {
      const creativeAgents = responsibilityMatrices.filter(
        m => m.cluster === 'creative'
      );

      for (const agent of creativeAgents) {
        expect(agent.executionPhase).toBe(2);
      }
    });

    it('should have Growth in Phase 3', () => {
      const growthAgents = responsibilityMatrices.filter(
        m => m.cluster === 'growth'
      );

      for (const agent of growthAgents) {
        expect(agent.executionPhase).toBe(3);
      }
    });
  });
});
