/**
 * Agent Responsibilities — Phase 1
 * เรียบง่าย ไม่มี dependency chain ซับซ้อน
 * ทุก agent ทำงานได้อิสระ — ไม่บังคับลำดับ
 */

export const agentResponsibilities = {
  'brand-builder': {
    owns: ['brand profile', 'naming', 'tagline', 'target audience', 'unique advantage'],
    canHandoff: ['content-creator', 'market-insight'],
    phase: 1,
  },
  'content-creator': {
    owns: ['captions', 'scripts', 'hooks', 'hashtags', 'platform copy'],
    canHandoff: ['campaign-planner'],
    phase: 1,
  },
  'business-planner': {
    owns: ['business plan 11 องค์ประกอบ', 'SWOT เบื้องต้น', 'เป้าหมาย SMART', 'แผนการเงินและจุดคุ้มทุน', 'แผนรองรับความเสี่ยง'],
    canHandoff: ['campaign-planner', 'market-insight', 'brand-builder'],
    phase: 1,
  },
  'campaign-planner': {
    owns: ['campaign timeline', 'post calendar', 'promotion schedule', 'channel mix'],
    canHandoff: ['content-creator', 'market-insight'],
    phase: 1,
  },
  'market-insight': {
    owns: ['competitor analysis', 'market gaps', 'trend direction', 'opportunity mapping'],
    canHandoff: ['brand-builder', 'campaign-planner'],
    phase: 1,
  },
  'advisor': {
    owns: ['general Q&A', 'concept explanation', 'routing', 'onboarding'],
    canHandoff: ['brand-builder', 'content-creator', 'campaign-planner', 'business-planner', 'market-insight'],
    phase: 1,
  },
} as const;
