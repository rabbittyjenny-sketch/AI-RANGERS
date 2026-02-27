/**
 * Intelligence & Knowledge Base
 * System Core Rules & Master Context Templates
 */

export interface MasterContext {
  // === BASIC IDENTIFICATION ===
  brandId: string;
  brandNameTh: string;
  brandNameEn: string;
  industry: string;

  // === STRATEGY_DATA (Bucket 1) ===
  coreUSP: string[]; // CHANGED: Array of 2-3 USPs instead of single string
  businessModel?: string; // B2B, B2C, Subscription, Hybrid
  competitors?: string[]; // Array of competitor names for analysis
  legalInfo?: {
    taxId: string;
    companyAddress: string;
  };

  // === CREATIVE_DATA (Bucket 2) ===
  visualStyle: {
    primaryColor: string;
    secondaryColors?: string[]; // Array of hex colors
    fontFamily?: string[]; // [primary, secondary]
    moodKeywords: string[]; // e.g., ["vibrant", "modern", "luxury"]
    videoStyle?: string; // Cinematic, fast-cut, slow-paced
    forbiddenElements?: string[]; // Visual elements to avoid
  };

  // === GROWTH_DATA (Bucket 3) ===
  targetAudience: string; // General description
  targetPersona?: string; // Detailed persona (age/job/lifestyle)
  painPoints?: string[]; // Array of customer pain points
  toneOfVoice: 'formal' | 'casual' | 'playful' | 'professional' | 'luxury';
  forbiddenWords?: string[]; // Words/phrases to avoid
  brandHashtags?: string[]; // Signature hashtags
  automationNeeds?: string[]; // NEW: Needs for automation (e.g., "social schedule", "email drip")

  // === METADATA ===
  logoUrl?: string;
  multilingualLevel?: string;
  createdAt: string;
  lastUpdated: string;
  isDefault?: boolean;
}

// System Core Rules - Isolation, Anti-Copycat, Fact Check
// These rules are enforced at Layer 1 (Orchestrator) as universal standards
export const systemCoreRules = {
  isolation: {
    name: 'Brand Data Isolation',
    description: 'ห้ามแชร์ข้อมูลข้าม brand_id โดยเด็ดขาด',
    rules: [
      'ทุกข้อมูลลูกค้าต้องเก็บแยกตาม brand_id',
      'ห้ามเรียกข้อมูลแบรนด์อื่น - ตรวจสอบ brand_id ก่อนทุกครั้ง',
      'Cache ต้องแยกตาม brand_id พร้อม TTL (time-to-live)',
      'Cross-Agent Logic ให้เฉพาะข้อมูลที่เกี่ยวข้องเท่านั้น (filter by data_type)',
      'Anonymous Learning: หากจะนำข้อมูลมาเรียนรู้ต้องลบชื่อแบรนด์และ PII ออกก่อนเสมอ',
      'API Security: ทุกการเรียก API ต้องพากัด brand_id ใน header หรือ payload'
    ]
  },
  antiCopycat: {
    name: 'Non-Plagiarism & IP Protection',
    description: 'ป้องกันการเลียนแบบและรักษาสิทธิ์ทางปัญญา',
    rules: [
      'ห้ามใช้แคปชั่นหรือสโลแกนที่มีอยู่แล้ว 100% ต้องมี Rephrase เสมอ (< 70% similarity)',
      'ทุกแคปชั่นต้อง Rephrase ให้เข้ากับ Brand Voice ของผู้ใช้ (personalation required)',
      'ห้ามแนะนำชื่อหรือสโลแกนที่จดทะเบียนเครื่องหมายการค้าแล้ว (No Trademark Violation)',
      'Uniqueness check: ทุกผลลัพธ์ต้องมี Unique Value ของแบรนด์นี้ (differentiation required)',
      'ห้ามนำ Case Study ของแบรนด์ A ไปตอบในห้องแชทของแบรนด์ B (brand isolation)',
      'Plagiarism Detection: ใช้ similarity checker หากต้องอ้างอิงข้อมูล (cite sources)'
    ]
  },
  artStyleProtection: {
    name: 'Art Style Protection',
    description: 'การป้องกันสไตล์งานภาพ - ห้ามเลียนแบบศิลปินมีตัวตน',
    rules: [
      'AI จะต้องไม่เจนภาพที่เลียนแบบลายเส้นของศิลปินที่มีตัวตนจริง (artist name detection)',
      'ใช้ "Mood & Tone Keywords" ของแบรนด์มาผสมผสานแทนชื่อศิลปิน (mood-based prompting)',
      'Original Prompting: สร้างจาก brand identity ไม่ใช่จากอ้างอิงศิลปินคนอื่น (original synthesis)',
      'ยกเว้นเฉพาะศิลปินสากลที่เป็น Public Domain (เสียชีวิตมานานกว่า 70 ปี) (PD check)',
      'Mood Keywords Priority: ถ้า mood keywords มี "minimalist + warm" ห้ามแนะนำศิลปินซืกเริง'
    ]
  },
  factCheck: {
    name: 'Fact Check & Data Integrity',
    description: 'ตรวจสอบความถูกต้องและความสมบูรณ์ของข้อมูล',
    rules: [
      'USP Grounding: ทุกคำกล่าวอ้างต้องสอดคล้องกับ Core USP (validate against brand USP array)',
      'No Hallucination for Data: ถ้าไม่แน่ใจต้องบอกทันทีว่า "ประมาณการ" หรือ "ต้องการเพิ่มเติม"',
      'Consistency Check: ตรวจทานกับ Master Context + Brand Knowledge Template ทุกครั้ง',
      'Reference Validation: ต้องระบุแหล่งที่มาเมื่ออ้างอิง (citation required)',
      'Data-Driven Claims: สถิติและตัวเลขต้องมีแหล่งที่มาชัดเจน หากไม่มีให้ใช้คำว่า "อ้างอิง/ประมาณการ"',
      'Tone Alignment: ตรวจว่าโทนเสียงตรงกับ growth_data.communication.tone_of_voice'
    ]
  },
  verificationAndQuality: {
    name: 'Verification & Quality Assurance',
    description: 'ตรวจสอบคุณภาพ Output ก่อนส่งให้ผู้ใช้',
    rules: [
      'Confidence Threshold: ทุก Agent ต้องมี confidence score (ตามประเภท Agent)',
      'Smart Retry: ถ้า confidence < threshold ให้ retry สูงสุด 2 ครั้ง (configurable per agent)',
      'Escalation: ถ้า retry สำเร็จแล้วแต่ยังต่ำ ให้ escalate ให้ Orchestrator (user notification)',
      'Quality Gate: ก่อนส่ง response ต้องผ่าน 4 rules (Isolation + Anti-Copycat + Fact Check + Consistency)',
      'User Notification: ถ้า verification fail ให้บอกผู้ใช้ด้วยความชัดเจน (error message + suggestion)'
    ]
  },
  agentCoordination: {
    name: 'Cross-Agent Coordination',
    description: 'การประสานงานระหว่าง Agents ให้ทำงานร่วมกันได้อย่างปรองดอง',
    rules: [
      'Cross-Cluster Data Flow: Agency ต้องใช้ USP จาก Strategist เพื่อทำแคปชั่นให้เด่นจุด',
      'Mood Alignment: Video Generator (Art) ต้องตรวจว่าสี/style ตรงกับ Mood Keywords ของ Studio',
      'Budget Consistency: Campaign Planner ต้องตรวจว่างบประมาณรวมไม่เกินที่ผู้ใช้ระบุ',
      'Handoff Data: เมื่อส่งต่องานข้าม Agent ต้องมี context + Brand Knowledge + task-specific data',
      'Precedence Rule: ถ้า Agent A เสร็จ Agent B ต้องยอมรับผลลัพธ์ของ Agent A เป็นอินพุต'
    ]
  }
};

/**
 * System-wide IP Protection Policy (injected into all agent system prompts)
 */
export const ipProtectionPolicy = {
  systemPrompt: `คุณห้ามใช้ความลับทางการค้าจากประวัติการทำงานของแบรนด์อื่นมาตอบลูกค้าปัจจุบัน
ผลลัพธ์ทุกอย่างต้องถูกปรับแต่ง (Customize) ให้เข้ากับบุคลิกของแบรนด์ที่ระบุไว้ใน brand_knowledge เท่านั้น
ห้ามคัดลอกคำต่อคำจากแหล่งใดๆ ต้อง Rephrase ด้วย Brand Voice ของผู้ใช้เสมอ
ห้ามเจนภาพเลียนแบบศิลปินมีตัวตน ใช้ Mood & Tone Keywords แทน`,
  enforcement: {
    preCheck: true,   // Check before generating content
    postCheck: true,  // Validate after content is generated
    blockOnViolation: true  // Block output if violation detected
  }
};

// Knowledge Base by Cluster
export const clusterKnowledge = {
  strategy: {
    name: 'The Strategist Knowledge Base',
    description: 'ความรู้เกี่ยวกับวิเคราะห์ธุรกิจ กลยุทธ์ การเงิน',
    domains: [
      'Market Analysis',
      'Business Strategy',
      'Financial Planning',
      'KPI Management',
      'Competitive Intelligence',
      'Customer Behavior',
      'Sales Forecasting',
      'Risk Assessment'
    ],
    examples: [
      'วิเคราะห์ SWOT ร้านกาแฟ',
      'ทำไมยอดขายตก?',
      'ขยายสาขาคุ้มไหม?',
      'จะตั้งราคาเท่าไหร่ดี?',
      'Dashboard ควรมีอะไรบ้าง?',
      'KPIs สำคัญมีอะไรบ้าง?'
    ]
  },
  creative: {
    name: 'The Studio Knowledge Base',
    description: 'ความรู้เกี่ยวกับออกแบบ แบรนด์ และศิลป์',
    domains: [
      'Brand Identity',
      'Visual Design',
      'UI/UX Design',
      'Color Theory',
      'Typography',
      'Layout Design',
      'Art Direction',
      'Mood & Tone'
    ],
    examples: [
      'ออกแบบโลโก้ร้านเสื้อผ้า',
      'Color Palette สำหรับแบรนด์อาหาร',
      'Brand Identity มีอะไรบ้าง?',
      'อยากได้โลโก้ใหม่',
      'สีแบรนด์เราคืออะไร?',
      'จัด Moodboard ให้หน่อย'
    ]
  },
  growth: {
    name: 'The Agency Knowledge Base',
    description: 'ความรู้เกี่ยวกับสื่อสาร คอนเทนต์ และการขาย',
    domains: [
      'Content Marketing',
      'Copywriting',
      'Social Media Strategy',
      'Influencer Marketing',
      'Campaign Planning',
      'Video Production',
      'Conversion Optimization',
      'Live Stream Strategy'
    ],
    examples: [
      'วางแผนแคมเปญ 30 วัน',
      'Content Calendar ยังไงดี?',
      'ช่วยคิดแคปชั่นโดนๆ',
      'ทำคลิปตามเทรนด์ TikTok',
      'Double Digit Strategy คืออะไร?',
      'Video Showroom ควรยาวเท่าไหร่?'
    ]
  }
};

// Routing Keywords Mapping
export const routingKeywords = {
  strategy: [
    // Market Analyzer
    'SWOT', 'competitor', 'market', 'gap', 'opportunity', 'trend',
    'analysis', 'research', 'customer behavior', 'audience insight',
    // Positioning Strategist
    'cost', 'pricing', 'budget', 'plan', 'financial', 'ROI', 'break-even',
    'expense', 'investment', 'profit', 'margin',
    // Customer Insight Specialist
    'KPI', 'analytics', 'performance', 'metrics', 'report', 'dashboard',
    'insight', 'data', 'forecast', 'projection'
  ],
  creative: [
    // Brand Voice Architect
    'brand', 'identity', 'mood', 'tone', 'personality', 'value', 'voice',
    'positioning', 'guidelines',
    // Visual Strategist
    'design', 'logo', 'UI', 'UX', 'visual', 'color', 'palette', 'typography',
    'layout', 'landing page', 'website', 'template',
    // Narrative Designer
    'video', 'theme', 'concept', 'visual', 'story', 'motion', 'animation',
    'showroom', 'media'
  ],
  growth: [
    // Content Creator (Caption Mode)
    'caption', 'content', 'copy', 'text', 'multilingual', 'emoji', 'CTA',
    'hashtag', 'style', 'emotion',
    // Campaign Planner
    'campaign', 'calendar', 'schedule', 'plan', 'promotion', '30 days',
    'content strategy', 'posting schedule', 'viral',
    // Content Creator (Script Mode)
    'script', 'production', 'trending', 'viral', 'live stream', 'editing',
    'concept', 'direction'
  ]
};

// Fact Check Validators
export interface FactCheckValidator {
  name: string;
  check: (context: MasterContext, claim: string) => { valid: boolean; message: string };
}

export const factCheckValidators: FactCheckValidator[] = [
  {
    name: 'USP Consistency',
    check: (context: MasterContext, claim: string) => {
      const uspArray = Array.isArray(context.coreUSP) ? context.coreUSP : [context.coreUSP];
      const uspLower = uspArray.join(' ').toLowerCase();
      const claimLower = claim.toLowerCase();

      // Check if claim contradicts known USP
      if (uspLower.includes('eco') && claimLower.includes('plastic')) {
        return {
          valid: false,
          message: 'เตือน: คำกล่าวอ้างขัดกับ USP ของแบรนด์ (ระบุไว้ว่า eco-friendly)'
        };
      }

      return { valid: true, message: 'ผ่านการตรวจสอบ USP' };
    }
  },
  {
    name: 'Tone Alignment',
    check: (context: MasterContext, claim: string) => {
      const tone = context.toneOfVoice;

      // Simple validation - can be expanded
      if (tone === 'formal' && (claim.includes('lol') || claim.includes('omg'))) {
        return {
          valid: false,
          message: `เตือน: สไตล์การพูดไม่สอดคล้องกับ Tone (${tone})`
        };
      }

      return { valid: true, message: 'ผ่านการตรวจสอบ Tone' };
    }
  }
];

// Sample Master Context for Testing
export const sampleMasterContexts: MasterContext[] = [
  {
    brandId: 'coffee-shop-01',
    brandNameTh: 'คาเฟ่อาร์ต',
    brandNameEn: 'Art Coffee Studio',
    industry: 'Cafe & Coffee Shop',
    businessModel: 'B2C',
    coreUSP: [
      'Premium specialty coffee with artist workspace',
      'Community-driven creative space',
      'Freshly roasted beans daily'
    ],
    competitors: ['Artemis Cafe', '3HT Coffee', 'Ristr8to'],
    legalInfo: {
      taxId: '1234567890123',
      companyAddress: '123 Sukhumvit Road, Bangkok'
    },
    visualStyle: {
      primaryColor: '#8B4513',
      secondaryColors: ['#D2B48C', '#654321'],
      fontFamily: ['Playfair Display', 'Lato'],
      moodKeywords: ['warm', 'artistic', 'cozy', 'creative', 'sophisticated'],
      videoStyle: 'Cinematic, slow-paced, warm lighting',
      forbiddenElements: ['Plastic cups', 'Overly cartoonish styles', 'Neon colors']
    },
    targetAudience: 'Creative professionals, artists, students, coffee enthusiasts (25-45 years old)',
    targetPersona: 'Creative professionals (25-45y), artists, design students, coffee enthusiasts',
    painPoints: [
      'Need quiet workspace for focused creative work',
      'Looking for community with like-minded creatives',
      'Want quality specialty coffee while working'
    ],
    toneOfVoice: 'casual',
    forbiddenWords: ['Commercial', 'Corporate jargon', 'Overly formal Thai language'],
    brandHashtags: ['#ArtCoffeeStudio', '#CreativeSpace', '#CommunityFirst'],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  },
  {
    brandId: 'fashion-boutique-01',
    brandNameTh: 'บูติกแฟชั่นสยาม',
    brandNameEn: 'Siam Fashion Boutique',
    industry: 'Fashion & Apparel',
    businessModel: 'B2C',
    coreUSP: [
      'Sustainable Thai fashion with local artisans',
      'Fair-trade and eco-friendly materials',
      'Support for local communities'
    ],
    competitors: ['Haus of Abbi', 'Thai Artisan Hub'],
    visualStyle: {
      primaryColor: '#2C5F2D',
      secondaryColors: ['#8FB381', '#C4D4A8'],
      fontFamily: ['Montserrat', 'Lora'],
      moodKeywords: ['elegant', 'sustainable', 'Thai pride', 'modern', 'minimalist'],
      videoStyle: 'Documentary-style, natural lighting, handcraft focus'
    },
    targetAudience: 'Conscious fashion consumers, eco-aware millennials, Thai supporters (28-45 years)',
    targetPersona: 'Eco-conscious millennial women (25-40y), income 40k+/month, value sustainability',
    painPoints: [
      'Difficulty finding sustainable fashion',
      'Want to support local businesses',
      'Concerned about environmental impact'
    ],
    toneOfVoice: 'professional',
    forbiddenWords: ['Fast fashion', 'Cheap', 'Mass-produced'],
    brandHashtags: ['#SustainableFashion', '#ThaiPride', '#EcoFashion'],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  },
  {
    brandId: 'food-delivery-01',
    brandNameTh: 'เดลิเวอรี่อาหารหวาน',
    brandNameEn: 'Sweet Delivery',
    industry: 'Food Delivery Service',
    businessModel: 'B2C',
    coreUSP: [
      'Same-day premium dessert delivery with freshness guarantee',
      'Curated artisanal dessert selection',
      'Same-day delivery within Bangkok'
    ],
    competitors: ['Choco D', 'Dessert Dash'],
    visualStyle: {
      primaryColor: '#FF69B4',
      secondaryColors: ['#FFB6C1', '#FFC0CB'],
      fontFamily: ['Quicksand', 'Varela Round'],
      moodKeywords: ['fun', 'sweet', 'vibrant', 'playful', 'energetic'],
      videoStyle: 'Upbeat, fast-paced, colorful, celebration focus'
    },
    targetAudience: 'Young professionals, celebration seekers, dessert lovers (18-40 years)',
    targetPersona: 'Young women (20-35y) who celebrate occasions, middle to high income, social media active',
    painPoints: [
      'Hard to find fresh premium desserts quickly',
      'Want convenient celebration delivery',
      'Limited quality dessert options for gift-giving'
    ],
    toneOfVoice: 'playful',
    forbiddenWords: ['Cheap dessert', 'Low quality', 'Artificial'],
    brandHashtags: ['#SweetDelivery', '#DessertLover', '#CelebrationMode'],
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  }
];

// Onboarding Data Collection Template
export interface OnboardingData {
  step: 1 | 2 | 3 | 4;
  section: 'basic' | 'visual' | 'audience' | 'confirmation';
  completed: boolean;
}

export const onboardingSteps = [
  {
    step: 1,
    title: 'ข้อมูลพื้นฐาน',
    fields: [
      { id: 'brandNameTh', label: 'ชื่อแบรนด์ (ไทย)', required: true },
      { id: 'brandNameEn', label: 'Brand Name (English)', required: true },
      { id: 'industry', label: 'ประเภทธุรกิจ', required: true },
      { id: 'coreUSP', label: 'จุดเด่นหลัก (Core USP)', required: true, hint: 'You can enter 1-3 USPs separated by commas (e.g., "Premium quality, Eco-friendly, Local support")' }
    ]
  },
  {
    step: 2,
    title: 'ลักษณะทางสายตา',
    fields: [
      { id: 'primaryColor', label: 'สีหลัก', type: 'color', required: true },
      { id: 'moodKeywords', label: 'Mood Keywords (3 คำ)', required: true }
    ]
  },
  {
    step: 3,
    title: 'กลุ่มเป้าหมาย',
    fields: [
      { id: 'targetAudience', label: 'อธิบายกลุ่มเป้าหมาย', required: true },
      { id: 'toneOfVoice', label: 'ระดับความทางการ', type: 'select', required: true }
    ]
  },
  {
    step: 4,
    title: 'ยืนยันข้อมูล',
    section: 'confirmation'
  }
];

/**
 * Brand Knowledge Template (3-Bucket Architecture)
 * เก็บข้อมูลแบรนด์แยกตาม Cluster เพื่อให้ Orchestrator ส่งต่อได้ถูกจุด
 * Input Once, Use Everywhere - ลูกค้าเหนื่อยกรอกแค่ครั้งเดียว
 */
export interface BrandKnowledgeTemplate {
  brand_id: string;
  updated_at: string;

  // Bucket 1: Strategist Data (The Strategist Cluster)
  strategy_data: {
    brand_name: string;
    brand_name_en: string;
    industry: string;
    business_model?: string; // B2B, B2C, Subscription, etc.
    core_usp: string[]; // Array of 2-3 USPs
    competitors?: string[]; // ชื่อคู่แข่งที่อยากเปรียบเทียบ
    legal_info?: {
      tax_id: string; // เลขประจำตัวผู้เสียภาษี
      company_address: string; // ที่อยู่บริษัท
    };
  };

  // Bucket 2: Studio Data (The Studio Cluster)
  creative_data: {
    visual_identity: {
      primary_color: string; // #HEX_CODE
      secondary_colors?: string[]; // [#HEX1, #HEX2]
      font_family?: string[]; // ["Primary Font", "Secondary Font"]
      mood_and_tone: string[]; // ["Minimal", "Professional", "Cozy"]
    };
    brand_assets?: {
      logo_url?: string;
      video_style?: string; // "Cinematic", "Fast-cut", "Slow-paced"
      forbidden_elements?: string[]; // สิ่งที่ห้ามมีในภาพ
    };
  };

  // Bucket 3: Agency Data (The Agency Cluster)
  growth_data: {
    target_audience: {
      persona: string; // "อายุ/อาชีพ/ไลฟ์สไตล์"
      pain_points?: string[]; // ปัญหาที่ลูกค้าเจอ
    };
    communication: {
      tone_of_voice: string; // "เป็นกันเองแต่สุภาพ"
      language_level?: string; // Level 1-5 (ตามแถบเลื่อนความเท่)
      forbidden_words?: string[]; // "คำต้องห้าม"
      signature_hashtags?: string[]; // ["#แบรนด์เรา"]
    };
    automation_needs?: {
      line_oa?: string; // "@id_line"
      email_notification?: string; // "email@example.com"
    };
  };
}

/**
 * Part B: Task-Specific Data Collection (Onboarding Strategy)
 * ข้อมูลเฉพาะงาน - Orchestrator จะถามเพิ่มเมื่อผู้ใช้กดใช้ Agent ตัวนั้นๆ
 * "ไม่ขอทีเดียวหมด" - Smart Lazy approach
 */
export interface TaskSpecificPrompt {
  agentId: string;
  trigger: string; // When to ask
  questions: {
    id: string;
    question: string;
    questionTh: string;
    type: 'text' | 'select' | 'multiselect';
    options?: string[];
    required: boolean;
    placeholder?: string;
  }[];
}

export const taskSpecificPrompts: TaskSpecificPrompt[] = [
  // automation-specialist removed (Phase 2)
  {
    agentId: 'campaign-planner',
    trigger: 'first_use',
    questions: [
      {
        id: 'campaignBudget',
        question: 'What is your monthly ad budget?',
        questionTh: 'งบโฆษณาต่อเดือนประมาณเท่าไหร่?',
        type: 'select',
        options: ['Under 5,000 THB', '5,000-20,000 THB', '20,000-50,000 THB', '50,000+ THB', 'No budget yet'],
        required: true
      },
      {
        id: 'campaignPlatforms',
        question: 'Which platforms do you want to focus on?',
        questionTh: 'ต้องการเน้นแพลตฟอร์มไหนบ้าง?',
        type: 'multiselect',
        options: ['Facebook', 'Instagram', 'TikTok', 'YouTube', 'Twitter/X'],
        required: true
      }
    ]
  },
  {
    agentId: 'content-creator',
    trigger: 'first_use',
    questions: [
      {
        id: 'contentMode',
        question: 'What content mode do you need?',
        questionTh: 'ต้องการคอนเทนต์รูปแบบไหน?',
        type: 'select',
        options: ['Caption Strategy (Social Posts)', 'Video Script (TikTok/Reels)', 'Both (Dual-Mode)'],
        required: true
      },
      {
        id: 'contentPlatform',
        question: 'Primary platform?',
        questionTh: 'แพลตฟอร์มหลัก?',
        type: 'select',
        options: ['TikTok', 'Instagram', 'Facebook', 'YouTube', 'Multiple'],
        required: true
      }
    ]
  },
  {
    agentId: '_adhoc',
    trigger: 'unknown_task',
    questions: [
      {
        id: 'adHocGoal',
        question: 'What is the goal of this task?',
        questionTh: 'เป้าหมายของงานนี้คืออะไร?',
        type: 'text',
        required: true,
        placeholder: 'e.g., Create a landing page for new product launch'
      },
      {
        id: 'adHocOutputFormat',
        question: 'What output format do you need?',
        questionTh: 'ต้องการผลลัพธ์ในรูปแบบไหน?',
        type: 'select',
        options: ['Text/Document', 'Image/Visual', 'Spreadsheet/Data', 'Code/Script', 'Presentation'],
        required: true
      }
    ]
  }
];

/**
 * Get task-specific prompts for an agent
 */
export function getTaskPrompts(agentId: string): TaskSpecificPrompt | undefined {
  return taskSpecificPrompts.find(p => p.agentId === agentId);
}

// Daily Learning Topics (For Content Inspiration)
export const dailyLearningTopics = {
  topics: [
    {
      date: new Date().toISOString().split('T')[0],
      topic: 'Valentine\'s Day Trend',
      keywords: ['love', 'couple', 'gift', 'celebration'],
      platforms: ['TikTok', 'Instagram', 'Facebook']
    },
    {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      topic: 'CNY Preparation Content',
      keywords: ['red', 'lucky', 'tradition', 'family'],
      platforms: ['TikTok', 'Instagram', 'Xiaohongshu']
    }
  ]
};
