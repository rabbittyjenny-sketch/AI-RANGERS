/**
 * Mock Data & Test Fixtures
 * For system testing and demonstration
 */

import { MasterContext } from './intelligence';
import { Agent } from './agents';

// Sample test conversations and interactions
export const mockConversations = [
  {
    id: 'conv_001',
    brandId: 'coffee-shop-01',
    timestamp: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: 'วิเคราะห์ SWOT ร้านกาแฟของเรา'
      },
      {
        role: 'agent',
        agentId: 'market-analyzer',
        agentName: 'Market Analyzer',
        content: 'แล้ว! มาวิเคราะห์ SWOT ร้านกาแฟของเรากันนะ...'
      }
    ]
  },
  {
    id: 'conv_002',
    brandId: 'coffee-shop-01',
    timestamp: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: 'ออกแบบโลโก้ใหม่'
      },
      {
        role: 'agent',
        agentId: 'visual-strategist',
        agentName: 'Visual Strategist',
        content: 'มาออกแบบโลโก้ที่สะท้อนบุคลิก Art Coffee Studio...'
      }
    ]
  },
  {
    id: 'conv_003',
    brandId: 'fashion-boutique-01',
    timestamp: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: 'วางแผนแคมเปญ 30 วัน'
      },
      {
        role: 'agent',
        agentId: 'campaign-planner',
        agentName: 'Campaign Planner',
        content: 'มาวางแผนแคมเปญ 30 วัน ตามเทรนด์ปัจจุบัน...'
      }
    ]
  }
];

// Sample analysis results
export const mockAnalysisResults = {
  swot_coffee: {
    agentId: 'market-analyzer',
    analysis: 'SWOT Analysis: Art Coffee Studio',
    strengths: [
      'Premium specialty coffee with unique brewing methods',
      'Artist-friendly workspace with creative atmosphere',
      'Strong community engagement',
      'Authentic Thai-inspired decor'
    ],
    weaknesses: [
      'Higher price point than competitors',
      'Limited marketing presence',
      'Small location capacity',
      'Dependence on specialty supplier chains'
    ],
    opportunities: [
      'Growing coffee culture in Bangkok',
      'Partnership with local artists for exhibitions',
      'Online ordering and delivery services',
      'Coffee workshops and training programs'
    ],
    threats: [
      'Increasing competition from chain cafes',
      'Rising rent costs in prime locations',
      'Changing consumer preferences',
      'Global supply chain disruptions'
    ]
  },

  pricing_coffee: {
    agentId: 'positioning-strategist',
    analysis: 'Pricing Strategy: Art Coffee Studio',
    recommendations: [
      {
        strategy: 'Premium Positioning',
        price_range: '80-150 THB per cup',
        rationale: 'Unique experience and specialty beans justify premium pricing'
      },
      {
        strategy: 'Value-Added Services',
        offerings: ['Latte Art Classes', 'Artist Collaborations', 'Private Bookings'],
        additional_revenue: '10,000-15,000 THB/month'
      },
      {
        strategy: 'Membership Program',
        description: 'Loyalty rewards for regular customers',
        expected_margin: '15-20% profit increase'
      }
    ]
  },

  caption_examples: {
    agentId: 'content-creator',
    examples: [
      {
        style: 'Emotional Hook',
        thai: '☕ กาแฟดีไม่ใช่แค่ เครื่องดื่ม มันคือ ประสบการณ์...',
        english: 'Premium coffee isn\'t just a beverage, it\'s a moment of pure bliss ✨'
      },
      {
        style: 'Educational',
        thai: '💡 รู้หรือไม่? กาแฟพิเศษของเรามาจากไร่อินทรีย์ที่ความสูง 1,200 เมตร',
        english: 'Did you know? Our specialty beans are sourced from certified organic farms at 1,200m altitude'
      },
      {
        style: 'Playful',
        thai: '🎨 ทำไมคนศิลปิเลือกที่นี่? เพราะกาแฟเสมหะนิ!',
        english: 'Why do artists choose us? Because our coffee is literally ART ☕✨'
      },
      {
        style: 'Problem-Solution',
        thai: '😫 เหนื่อยจากกาแฟธรรมดา? มาลองพิเศษ ณ Art Coffee Studio',
        english: 'Tired of bland coffee from chains? Discover something extraordinary ✨'
      },
      {
        style: 'Social Proof',
        thai: '🌟 เข้าร่วม 500+ ชาวศิลปิ ที่เลือก Art Coffee Studio',
        english: 'Join 500+ creative minds who choose quality over ordinary ☕'
      },
      {
        style: 'Call-to-Action',
        thai: '👉 คลิก Link ด้านล่าง เพื่อ Reserve ที่นั่ง',
        english: 'Tap the link in bio to reserve your spot today 👆'
      }
    ]
  },

  campaign_calendar: {
    agentId: 'campaign-planner',
    month: 'February 2025',
    phases: [
      {
        phase: 1,
        name: 'Gain Friends',
        dates: 'Feb 1-10',
        focus: 'Build audience and awareness',
        posts: [
          'Behind-the-scenes content',
          'Artist collaboration teasers',
          'Coffee brewing tips'
        ]
      },
      {
        phase: 2,
        name: 'Conversion Drive',
        dates: 'Feb 11-27',
        focus: 'Drive sales and engagement',
        posts: [
          'Product showcase videos',
          'Customer testimonials',
          'Limited-time offers',
          'Event announcements'
        ]
      },
      {
        phase: 3,
        name: 'Retargeting',
        dates: 'Feb 28-Mar 5',
        focus: 'Convert interested prospects',
        posts: [
          'Urgency-driven promotions',
          'Last-chance offers',
          'Customer success stories'
        ]
      }
    ]
  }
};

// Dashboard mock data
export const mockDashboardData = {
  kpis: {
    totalReach: 45230,
    engagement: 3421,
    conversionRate: 12.8,
    customerAcquisitionCost: 250,
    lifetimeValue: 3500
  },
  recentActivity: [
    {
      date: new Date().toISOString(),
      event: 'New follower: Design enthusiast community',
      impact: '+50 followers'
    },
    {
      date: new Date(Date.now() - 86400000).toISOString(),
      event: 'Post engagement spike on coffee art tutorial',
      impact: '+250 likes, +45 comments'
    },
    {
      date: new Date(Date.now() - 172800000).toISOString(),
      event: 'Partnership mention with local artist',
      impact: '+120 clicks'
    }
  ],
  topPerformingContent: [
    {
      title: 'Coffee Latte Art Demonstration',
      engagement: 1850,
      reach: 8930,
      type: 'video'
    },
    {
      title: 'Artist Feature: @designstudio_bangkok',
      engagement: 1220,
      reach: 6120,
      type: 'post'
    },
    {
      title: 'Friday Night Jazz + Coffee Vibes',
      engagement: 890,
      reach: 4560,
      type: 'carousel'
    }
  ]
};

// Routing test cases
export const routingTestCases = [
  {
    input: 'วิเคราะห์ SWOT ร้านกาแฟ',
    expectedCluster: 'strategy',
    expectedAgent: 'market-analyzer',
    reason: 'Contains SWOT keyword - Market Analyst'
  },
  {
    input: 'ออกแบบโลโก้ใหม่สำหรับแบรนด์',
    expectedCluster: 'creative',
    expectedAgent: 'visual-strategist',
    reason: 'Contains design/logo keyword - Design Agent'
  },
  {
    input: 'วางแผนแคมเปญ 30 วัน',
    expectedCluster: 'growth',
    expectedAgent: 'campaign-planner',
    reason: 'Contains campaign keyword - Campaign Planner'
  },
  {
    input: 'คำนวณต้นทุนและตั้งราคา',
    expectedCluster: 'strategy',
    expectedAgent: 'positioning-strategist',
    reason: 'Contains cost/pricing keyword - Positioning Strategist'
  },
  {
    input: 'Color Palette สำหรับแบรนด์อาหาร',
    expectedCluster: 'creative',
    expectedAgent: 'visual-strategist',
    reason: 'Contains color/design keyword - Design Agent'
  },
  {
    input: 'เขียนแคปชั่นให้หลายสไตล์',
    expectedCluster: 'growth',
    expectedAgent: 'content-creator',
    reason: 'Contains caption keyword - Content Creator'
  }
];

// Fact check test cases
export const factCheckTestCases = [
  {
    brandUSP: 'Eco-friendly sustainable packaging',
    claim: 'We use plastic-free, biodegradable materials',
    shouldPass: true,
    reason: 'Consistent with eco-friendly USP'
  },
  {
    brandUSP: 'Premium luxury experience',
    claim: 'Affordable prices starting at 100 THB',
    shouldPass: false,
    reason: 'Contradicts premium positioning'
  },
  {
    brandUSP: 'Local artisan products',
    claim: 'Handmade by local Bangkok artisans',
    shouldPass: true,
    reason: 'Reinforces local artisan USP'
  },
  {
    brandUSP: 'Professional corporate solutions',
    claim: 'Lol this is so fun and crazy! 🎉',
    shouldPass: false,
    reason: 'Tone doesn\'t match professional voice'
  }
];

// System readiness checklist
export const systemReadinessChecklist = [
  {
    item: 'All agents data loaded',
    status: 'pass',
    timestamp: new Date().toISOString()
  },
  {
    item: 'Orchestrator Engine initialized',
    status: 'pass',
    timestamp: new Date().toISOString()
  },
  {
    item: 'Master Context available',
    status: 'conditional',
    note: 'Requires onboarding completion'
  },
  {
    item: 'Anti-Copycat validation active',
    status: 'pass',
    timestamp: new Date().toISOString()
  },
  {
    item: 'Fact-check rules loaded',
    status: 'pass',
    timestamp: new Date().toISOString()
  },
  {
    item: 'Cross-Agent Logic ready',
    status: 'pass',
    timestamp: new Date().toISOString()
  }
];

// Export all mock data
export const mockDataSummary = {
  conversations: mockConversations.length,
  analysisResults: Object.keys(mockAnalysisResults).length,
  routingTestCases: routingTestCases.length,
  factCheckTestCases: factCheckTestCases.length,
  dashboardMetrics: Object.keys(mockDashboardData).length,
  systemChecks: systemReadinessChecklist.length
};
