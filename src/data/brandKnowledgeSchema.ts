/**
 * Brand Knowledge Master Schema
 * ข้อมูลรวมเดียวที่ Agent ทั้งสามกลุ่มใช้ทำงาน
 * "Input Once, Use Everywhere" principle
 */

export interface BrandKnowledgeSchema {
  // ========================================
  // Core Identification
  // ========================================
  brand_id: string;                    // Unique identifier (brand-001, shop-123, etc)
  brand_name_th: string;               // ชื่อแบรนด์ (ไทย)
  brand_name_en: string;               // Brand Name (English)
  updated_at: string;                  // ISO timestamp when last updated
  created_by: string;                  // Email of brand owner

  // ========================================
  // STRATEGY DATA SECTION
  // (ใช้โดย: Market Analyst, Business Planner, Insights Agent)
  // ========================================
  strategy_data: {
    industry: string;                  // ประเภทธุรกิจ (e.g., Cafe, Fashion, Tech)
    business_model: string;            // B2B, B2C, D2C, Subscription, Marketplace

    // Core Business Information
    usp: {
      primary: string;                 // จุดเด่นหลัก (Core USP)
      secondary: string[];             // จุดเด่นรอง 2-3 อย่าง
      tagline: string;                 // สโลแกนหลัก
    };

    // Market Information
    competitors: {
      name: string;
      strengths: string[];
      weaknesses: string[];
      market_position: string;
    }[];

    // Financial Information
    pricing_strategy: {
      entry_price: number;             // ราคาต่ำสุด
      premium_price: number;           // ราคาสูงสุด
      cost_of_goods: number;           // ต้นทุน
      profit_margin_target: number;    // เป้าหมาย profit %
      currency: string;                // THB, USD, etc
    };

    // Legal Information
    legal_info: {
      business_name: string;
      tax_id: string;                  // เลขประจำตัวผู้เสียภาษี
      business_address: string;        // ที่ตั้งสำหรับออกเอกสาร
      phone_number: string;
      email: string;
      business_registration_no: string;
    };

    // KPI & Metrics (Updated by Insights Agent)
    current_metrics: {
      monthly_revenue?: number;
      customer_count?: number;
      conversion_rate?: number;
      average_order_value?: number;
      last_updated: string;
    };
  };

  // ========================================
  // CREATIVE DATA SECTION
  // (ใช้โดย: Brand Builder, Design Agent, Video Generator Art)
  // ========================================
  creative_data: {
    visual_identity: {
      // Color System
      colors: {
        primary: string;               // #HEX_CODE (main brand color)
        secondary: string[];           // [#HEX1, #HEX2] (supporting colors)
        accent: string;                // #HEX_CODE (for CTAs)
        neutral_light: string;         // #HEX (backgrounds)
        neutral_dark: string;          // #HEX (text)
      };

      // Typography
      typography: {
        primary_font: string;          // e.g., "Oswald" (headlines)
        secondary_font: string;        // e.g., "Spectral" (body text)
        brand_font_rules: string;      // e.g., "ALL CAPS for headlines, Sentence case for body"
      };

      // Mood & Aesthetics
      mood_keywords: string[];         // e.g., ["warm", "artistic", "cozy", "creative", "sophisticated"]
      aesthetic_style: string;         // e.g., "Minimalist", "Luxury", "Playful", "Professional"
      design_pattern: string;          // e.g., "Grid-based", "Asymmetric", "Nature-inspired"
    };

    // Brand Assets
    brand_assets: {
      logo_url: string;                // ลิงก์ไฟล์โลโก้
      logo_variations: string[];       // [horizontal, vertical, icon-only, etc]
      brand_guideline_url?: string;    // Brand book or guideline document

      // Video Style Guidelines
      video_style: {
        format: string;                // "Cinematic", "Documentary", "Fast-cut", "Slow-paced", "Educational"
        duration_preference: string;   // "15-30s", "30-60s", "Long-form"
        aspect_ratio: string[];        // ["9:16", "16:9", "1:1"] for different platforms
        music_style: string;           // "Upbeat", "Calm", "Ambient", "Modern"
      };

      // Photography Guidelines
      photography_style: string[];     // e.g., ["Lifestyle", "Product-focused", "Minimalist", "Behind-the-scenes"]
    };

    // Accessibility & Technical
    accessibility: {
      needs_captions: boolean;         // Always add captions? (yes/no)
      needs_alt_text: boolean;         // For images
      color_contrast_rating: string;   // "AAA", "AA", "Standard"
    };
  };

  // ========================================
  // GROWTH DATA SECTION
  // (ใช้โดย: Caption Creator, Campaign Planner, Video Generator Script, Automation Specialist)
  // ========================================
  growth_data: {
    // Audience Profile
    target_audience: {
      personas: {
        name: string;
        age_range: string;
        occupation: string;
        lifestyle: string;
        pain_points: string[];
        desires: string[];
        media_consumption: string[];   // e.g., ["TikTok", "Instagram", "YouTube"]
      }[];
    };

    // Communication Style
    communication: {
      tone_of_voice: string;           // e.g., "เป็นกันเองแต่สุภาพ", "Professional", "Playful"
      language_level: number;          // 1-5 (1=simple, 5=advanced)

      // Forbidden & Encouraged Language
      forbidden_words: string[];       // Words to NEVER use
      encouraged_words: string[];      // Words to ALWAYS use

      // Signature Elements
      signature_hashtags: string[];    // Brand hashtags
      signature_phrases: string[];     // Taglines or catchphrases to use

      // Multilingual Support
      default_language: string;        // "th", "en", etc
      supported_languages: string[];   // ["th", "en", "ch"]
    };

    // Platform Strategy
    platform_strategy: {
      primary_platform: string;        // e.g., "Instagram", "TikTok", "Facebook"
      secondary_platforms: string[];   // e.g., ["YouTube", "Twitter/X"]

      // Platform-specific rules
      instagram: {
        post_frequency: string;        // e.g., "3x per week"
        caption_length: string;        // "Long (150+ chars)", "Short (<100 chars)"
        hashtag_count: number;         // Recommended hashtag count
      };

      tiktok: {
        content_type: string[];        // e.g., ["Educational", "Entertainment", "Behind-the-scenes"]
        trend_participation: boolean;  // Should follow trends?
      };

      facebook: {
        community_engagement: boolean; // Active community management?
      };

    };

    // Marketing Calendar & Campaigns
    marketing_calendar: {
      yearly_campaigns: {
        month: number;
        campaign_name: string;
        theme: string;
        budget_allocation?: number;
      }[];

      recurring_events: {
        event_name: string;
        frequency: string;             // "Daily", "Weekly", "Monthly"
        day_of_week?: number;
      }[];
    };

    // Automation Integration
    automation_needs: {
      email_notification: {
        email: string;                 // Where to send notifications
        notification_triggers: string[]; // e.g., ["New order", "Customer inquiry"]
      };

      tool_stack: {
        email_platform?: string;       // e.g., "Mailchimp", "Klaviyo"
        crm?: string;                  // e.g., "HubSpot", "Salesforce"
        scheduler?: string;            // e.g., "Buffer", "Hootsuite"
        analytics?: string;            // e.g., "Google Analytics", "Meta Pixel"
      };
    };
  };

  // ========================================
  // CROSS-CUTTING DATA
  // (ใช้โดยหลาย agents พร้อมกัน)
  // ========================================
  cross_data: {
    // Brand Voice & Values
    brand_values: string[];            // e.g., ["Sustainability", "Innovation", "Trust"]
    brand_promise: string;             // What brand promises to customers

    // Historical Performance
    past_successful_campaigns: {
      campaign_name: string;
      result: string;
      engagement_rate: number;
      conversion_rate: number;
    }[];

    // Constraints & Requirements
    constraints: {
      must_include: string[];          // e.g., ["Tax ID", "Terms & Conditions"]
      must_exclude: string[];          // e.g., ["Competitor names", "Political content"]
      budget_limits: {
        monthly_ad_spend?: number;
        max_per_campaign?: number;
      };
    };

    // Additional Resources
    resources: {
      brand_guidelines_url?: string;
      competitor_analysis_url?: string;
      market_research_data?: string;
    };
  };
}

// ========================================
// TYPE EXPORTS FOR EACH CLUSTER
// ========================================

export type StrategyDataSet = BrandKnowledgeSchema['strategy_data'];
export type CreativeDataSet = BrandKnowledgeSchema['creative_data'];
export type GrowthDataSet = BrandKnowledgeSchema['growth_data'];
export type CrossDataSet = BrandKnowledgeSchema['cross_data'];

/**
 * Selective Data Distribution Helper
 * Orchestrator ใช้ function นี้เพื่อแจกจ่ายข้อมูลให้ Agent ตามที่พอเพียง
 */
export class BrandKnowledgeDistributor {
  /**
   * Get Strategy Data (for Market Analyst, Business Planner, Insights Agent)
   */
  static getStrategyContext(schema: BrandKnowledgeSchema) {
    return {
      brand_id: schema.brand_id,
      brand_name_th: schema.brand_name_th,
      brand_name_en: schema.brand_name_en,
      industry: schema.strategy_data.industry,
      usp: schema.strategy_data.usp,
      competitors: schema.strategy_data.competitors,
      pricing: schema.strategy_data.pricing_strategy,
      legal_info: schema.strategy_data.legal_info,
      metrics: schema.strategy_data.current_metrics,
      brand_values: schema.cross_data.brand_values,
      constraints: schema.cross_data.constraints
    };
  }

  /**
   * Get Creative Data (for Brand Builder, Design Agent, Video Generator Art)
   */
  static getCreativeContext(schema: BrandKnowledgeSchema) {
    return {
      brand_id: schema.brand_id,
      brand_name_th: schema.brand_name_th,
      visual_identity: schema.creative_data.visual_identity,
      brand_assets: schema.creative_data.brand_assets,
      accessibility: schema.creative_data.accessibility,
      mood_keywords: schema.creative_data.visual_identity.mood_keywords,
      brand_values: schema.cross_data.brand_values
    };
  }

  /**
   * Get Growth Data (for Caption Creator, Campaign Planner, Video Generator Script, Automation Specialist)
   */
  static getGrowthContext(schema: BrandKnowledgeSchema) {
    return {
      brand_id: schema.brand_id,
      brand_name_th: schema.brand_name_th,
      target_audience: schema.growth_data.target_audience,
      communication: schema.growth_data.communication,
      platform_strategy: schema.growth_data.platform_strategy,
      marketing_calendar: schema.growth_data.marketing_calendar,
      automation_needs: schema.growth_data.automation_needs,
      usp: schema.strategy_data.usp,
      visual_identity: schema.creative_data.visual_identity,
      brand_values: schema.cross_data.brand_values,
      constraints: schema.cross_data.constraints
    };
  }

  /**
   * Get Orchestrator Master Context (for routing & coordination)
   */
  static getOrchestratorContext(schema: BrandKnowledgeSchema) {
    return {
      brand_id: schema.brand_id,
      brand_name_th: schema.brand_name_th,
      brand_name_en: schema.brand_name_en,
      usp: schema.strategy_data.usp,
      mood_keywords: schema.creative_data.visual_identity.mood_keywords,
      tone_of_voice: schema.growth_data.communication.tone_of_voice,
      target_audience: schema.growth_data.target_audience,
      primary_platform: schema.growth_data.platform_strategy.primary_platform,
      automation_needs: schema.growth_data.automation_needs
    };
  }

  /**
   * Get minimal context for quick operations
   */
  static getMinimalContext(schema: BrandKnowledgeSchema) {
    return {
      brand_id: schema.brand_id,
      brand_name_th: schema.brand_name_th,
      usp: schema.strategy_data.usp.primary,
      tone: schema.growth_data.communication.tone_of_voice,
      mood: schema.creative_data.visual_identity.mood_keywords
    };
  }
}

/**
 * Example Usage
 */
export const exampleBrandSchema: BrandKnowledgeSchema = {
  brand_id: 'coffee-shop-01',
  brand_name_th: 'คาเฟ่อาร์ต',
  brand_name_en: 'Art Coffee Studio',
  updated_at: new Date().toISOString(),
  created_by: 'owner@artcoffee.com',

  strategy_data: {
    industry: 'Cafe & Coffee Shop',
    business_model: 'B2C + Online',

    usp: {
      primary: 'Premium specialty coffee with artist workspace',
      secondary: ['Local artists support', 'Instagram-worthy ambiance'],
      tagline: 'Where Coffee Meets Art'
    },

    competitors: [
      {
        name: 'StarBucks Branch 2',
        strengths: ['Brand recognition', 'Consistency'],
        weaknesses: ['Mass-produced taste', 'No local feel'],
        market_position: 'Premium chain'
      }
    ],

    pricing_strategy: {
      entry_price: 60,
      premium_price: 150,
      cost_of_goods: 20,
      profit_margin_target: 60,
      currency: 'THB'
    },

    legal_info: {
      business_name: 'ART COFFEE STUDIO CO., LTD.',
      tax_id: '1234567890123',
      business_address: '123 Sukhumvit Soi 15, Bangkok 10110, Thailand',
      phone_number: '02-123-4567',
      email: 'info@artcoffee.com',
      business_registration_no: 'BRN123456'
    },

    current_metrics: {
      monthly_revenue: 500000,
      customer_count: 2500,
      conversion_rate: 0.15,
      average_order_value: 120,
      last_updated: new Date().toISOString()
    }
  },

  creative_data: {
    visual_identity: {
      colors: {
        primary: '#8B4513',
        secondary: ['#D2B48C', '#A0826D'],
        accent: '#FF6B6B',
        neutral_light: '#FFF8F0',
        neutral_dark: '#3E3E3E'
      },

      typography: {
        primary_font: 'Oswald',
        secondary_font: 'Spectral',
        brand_font_rules: 'BOLD CAPS for brand name, Spectral for descriptions'
      },

      mood_keywords: ['warm', 'artistic', 'cozy', 'creative', 'sophisticated'],
      aesthetic_style: 'Artisan Minimalism',
      design_pattern: 'Grid-based with artistic elements'
    },

    brand_assets: {
      logo_url: 'https://example.com/logo.png',
      logo_variations: ['horizontal', 'vertical', 'icon-only'],

      video_style: {
        format: 'Cinematic',
        duration_preference: '15-30s for social, 60s+ for storytelling',
        aspect_ratio: ['9:16', '1:1'],
        music_style: 'Ambient + Indie'
      },

      photography_style: ['Lifestyle', 'Product-focused', 'Behind-the-scenes']
    },

    accessibility: {
      needs_captions: true,
      needs_alt_text: true,
      color_contrast_rating: 'AA'
    }
  },

  growth_data: {
    target_audience: {
      personas: [
        {
          name: 'Creative Professional',
          age_range: '25-45',
          occupation: 'Designer, Architect, Artist',
          lifestyle: 'Instagram-active, values aesthetics',
          pain_points: ['Noisy coffee chains', 'Uninspired spaces'],
          desires: ['Inspiring workspace', 'Quality coffee', 'Community'],
          media_consumption: ['Instagram', 'Facebook', 'TikTok']
        }
      ]
    },

    communication: {
      tone_of_voice: 'เป็นกันเองแต่สุภาพ, Thoughtful, Artistic',
      language_level: 3,
      forbidden_words: ['cheap', 'mass-produced', 'corporate'],
      encouraged_words: ['artisan', 'craft', 'inspire', 'space', 'create'],
      signature_hashtags: ['#ArtCoffeeStudio', '#WhereArtMeetsCoffee', '#CoffeeAndArt'],
      signature_phrases: ['Sip & Create', 'Where Ideas Brew'],
      default_language: 'th',
      supported_languages: ['th', 'en']
    },

    platform_strategy: {
      primary_platform: 'Instagram',
      secondary_platforms: ['TikTok', 'Facebook', 'YouTube'],

      instagram: {
        post_frequency: '3-4x per week',
        caption_length: 'Medium (100-150 chars)',
        hashtag_count: 8
      },

      tiktok: {
        content_type: ['Behind-the-scenes', 'Customer moments', 'Art features'],
        trend_participation: true
      },

      facebook: {
        community_engagement: true
      },

    },

    marketing_calendar: {
      yearly_campaigns: [
        {
          month: 4,
          campaign_name: 'Songkran Celebration',
          theme: 'Traditional meets Modern',
          budget_allocation: 50000
        }
      ],

      recurring_events: [
        {
          event_name: 'Artist Showcase Friday',
          frequency: 'Weekly',
          day_of_week: 5
        }
      ]
    },

    automation_needs: {
      email_notification: {
        email: 'owner@artcoffee.com',
        notification_triggers: ['New order', 'Customer feedback', 'Event signup']
      },

      tool_stack: {
        email_platform: 'Mailchimp',
        crm: 'HubSpot',
        scheduler: 'Buffer',
        analytics: 'Google Analytics'
      }
    }
  },

  cross_data: {
    brand_values: ['Creativity', 'Quality', 'Community', 'Sustainability'],
    brand_promise: 'Create your best work in an inspiring space with exceptional coffee',

    past_successful_campaigns: [
      {
        campaign_name: 'Artist Spotlight March 2025',
        result: '2,500 impressions, 150 new customers',
        engagement_rate: 0.12,
        conversion_rate: 0.06
      }
    ],

    constraints: {
      must_include: ['Our USP', 'Location info'],
      must_exclude: ['Competitor names'],
      budget_limits: {
        monthly_ad_spend: 30000,
        max_per_campaign: 10000
      }
    },

    resources: {
      brand_guidelines_url: 'https://example.com/guidelines.pdf',
      competitor_analysis_url: 'https://example.com/analysis'
    }
  }
};
