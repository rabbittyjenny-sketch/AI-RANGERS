import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from './aiService';
import { orchestratorEngine } from './orchestratorEngine';

// Mock dependencies
vi.mock('./databaseService', () => ({
    databaseService: {
        saveMessage: vi.fn().mockResolvedValue({}),
        getBrand: vi.fn().mockResolvedValue({ id: 1, brandNameTh: 'Test' })
    }
}));

vi.mock('./databaseContextService', () => ({
    databaseContextService: {
        getAgentContextByCluster: vi.fn().mockResolvedValue({}),
        getFieldsUsedByAgent: vi.fn().mockReturnValue([])
    },
    getAgentContext: vi.fn().mockResolvedValue({}),
    recordLearning: vi.fn().mockResolvedValue({})
}));

// Mock global fetch
globalThis.fetch = vi.fn();

describe('AIService Workflow Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        aiService.clearHistory();
    });

    it('should give soft advisory (not hard block) when forceAgent has unmet dependencies (Step 3)', async () => {
        // Visual Strategist depends on Market Analyzer + Positioning Strategist
        // With forceAgent set, the agent should still run (soft advisory, not hard block)
        const request = {
            userInput: 'ออกแบบโลโก้ให้หน่อย',
            forceAgent: 'visual-strategist'
        };

        const response = await aiService.processMessage(request);

        // Agent should have actually run (not blocked by orchestrator)
        expect(response.agentId).toBe('visual-strategist');
        // Response should include the soft workflow advisory tip
        expect(response.content).toContain('เคล็ดลับ');
    });

    it('should execute full workflow for a ready agent (Step 4, 5, 6)', async () => {
        // Market Analyzer usually has no dependencies or is ready
        const request = {
            userInput: 'ช่วยวิเคราะห์ตลาดให้หน่อย',
            forceAgent: 'market-analyzer'
        };

        // Mock successful Claude API response with structured data to pass validation
        const mockOutput = JSON.stringify({
            task: 'market analysis',
            result: 'found opportunities',
            reasoning: 'data analysis',
            swot: { strengths: ['test'], weaknesses: [], opportunities: [], threats: [] },
            competitors: ['comp1'],
            trends: ['test']
        });

        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                content: [{ type: 'text', text: mockOutput }]
            })
        });

        const response = await aiService.processMessage(request);

        expect(response.agentId).toBe('market-analyzer');
        expect(response.content).toContain('found opportunities');
        expect(response.factCheckResult.valid).toBe(true);
    });

    it('should use fallback if API fails', async () => {
        const request = {
            userInput: 'วิเคราะห์ตลาด',
            forceAgent: 'market-analyzer'
        };

        // Mock API failure
        (globalThis.fetch as any).mockRejectedValue(new Error('API Down'));

        const response = await aiService.processMessage(request);

        expect(response.content).toContain('ระบบใช้โหมดออฟไลน์');
        expect(response.content).toContain('การวิเคราะห์ตลาดสำหรับ');
    });
});
