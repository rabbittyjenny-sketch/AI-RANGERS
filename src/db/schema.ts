import { pgTable, text, serial, timestamp, boolean, integer, jsonb, varchar } from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';

// Brands Table - Core brand information + Brand Knowledge Template (3 Buckets)
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),

  // === STRATEGIST_DATA (Bucket 1) ===
  brandNameEn: varchar('brand_name_en', { length: 255 }).notNull(),
  brandNameTh: varchar('brand_name_th', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 255 }).notNull(),
  businessModel: varchar('business_model', { length: 50 }), // B2B, B2C, Subscription, Hybrid
  coreUsp: jsonb('core_usp'), // CHANGED: Array of 2-3 USPs instead of single string
  competitors: jsonb('competitors'), // NEW: Array of competitor names
  taxId: varchar('tax_id', { length: 50 }), // NEW: For business invoicing
  companyAddress: text('company_address'), // NEW: For official documents

  // === STUDIO_DATA (Bucket 2) ===
  primaryColor: varchar('primary_color', { length: 7 }),
  secondaryColors: jsonb('secondary_colors'), // NEW: Array of hex colors
  fontFamily: jsonb('font_family'), // CHANGED: Array [primary, secondary] instead of single
  moodKeywords: jsonb('mood_keywords'), // Array of mood keywords
  videoStyle: text('video_style'), // NEW: Cinematic, fast-cut, slow-paced, etc.
  forbiddenElements: jsonb('forbidden_elements'), // NEW: Array of forbidden visual elements
  logoUrl: text('logo_url'),

  // === AGENCY_DATA (Bucket 3) ===
  toneOfVoice: varchar('tone_of_voice', { length: 255 }),
  targetAudience: text('target_audience'), // General description
  targetPersona: text('target_persona'), // NEW: Detailed persona (age/job/lifestyle)
  painPoints: jsonb('pain_points'), // NEW: Array of customer pain points
  multilingualLevel: varchar('multilingual_level', { length: 50 }), // EN-only, EN-TH mix, TH-primary
  forbiddenWords: jsonb('forbidden_words'), // NEW: Array of words to avoid
  brandHashtags: jsonb('brand_hashtags'), // Array of hashtags
  automationEmail: varchar('automation_email', { length: 255 }), // Email for notifications
  automationLineOa: varchar('automation_line_oa', { length: 255 }), // LINE OA ID for notifications

  // === METADATA ===
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Brand = InferSelectModel<typeof brands>;

// SWOT Analyses Table - Market analysis outputs
export const swotAnalyses = pgTable('swot_analyses', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  strengths: jsonb('strengths'), // Array of strings
  weaknesses: jsonb('weaknesses'),
  opportunities: jsonb('opportunities'),
  threats: jsonb('threats'),
  marketTrends: text('market_trends'),
  competitorAnalysis: text('competitor_analysis'),
  confidence: integer('confidence'), // 0-100 percentage
  generatedBy: varchar('generated_by', { length: 100 }), // Agent name
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SwotAnalysis = InferSelectModel<typeof swotAnalyses>;

// Captions Table - Generated social media captions
export const captions = pgTable('captions', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  caption: text('caption').notNull(),
  captionTh: text('caption_th'), // Thai version if multilingual
  platform: varchar('platform', { length: 50 }), // Instagram, TikTok, Facebook, etc.
  contentType: varchar('content_type', { length: 100 }), // Product launch, Behind-the-scenes, etc.
  hashtags: jsonb('hashtags'), // Array of hashtags
  engagementTips: text('engagement_tips'),
  confidence: integer('confidence'),
  generatedBy: varchar('generated_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Caption = InferSelectModel<typeof captions>;

// Design Assets Table - Design outputs and specifications
export const designAssets = pgTable('design_assets', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  assetType: varchar('asset_type', { length: 100 }), // Logo, Banner, Social Card, etc.
  assetDescription: text('asset_description'),
  colorScheme: jsonb('color_scheme'), // Object with primary, secondary, accent colors
  typography: jsonb('typography'), // Object with font families and sizes
  dimensions: varchar('dimensions', { length: 50 }), // e.g., "1200x630"
  imageUrl: text('image_url'),
  cssCode: text('css_code'), // CSS for styling
  generatedBy: varchar('generated_by', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type DesignAsset = InferSelectModel<typeof designAssets>;

// Chat Messages Table - Conversation history
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(), // 'user' or 'agent'
  agentId: varchar('agent_id', { length: 100 }),
  agentName: varchar('agent_name', { length: 255 }),
  content: text('content').notNull(),
  attachments: jsonb('attachments'), // Array of file metadata
  confidence: integer('confidence'),
  validationResults: jsonb('validation_results'), // Anti-copycat, USP grounding, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Message = InferSelectModel<typeof messages>;

// Agent Learnings Table - Agent insights and improvements
export const agentLearnings = pgTable('agent_learnings', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  insight: text('insight').notNull(),
  insightType: varchar('insight_type', { length: 100 }), // Trend, Recommendation, Warning, etc.
  dataUsed: jsonb('data_used'), // Which fields from brand data were used
  confidence: integer('confidence'),
  actionable: boolean('actionable').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AgentLearning = InferSelectModel<typeof agentLearnings>;

// Campaign Schedules Table - Campaign planning and execution
export const campaignSchedules = pgTable('campaign_schedules', {
  id: serial('id').primaryKey(),
  brandId: integer('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  campaignName: varchar('campaign_name', { length: 255 }).notNull(),
  campaignObjective: text('campaign_objective'),
  targetAudience: text('target_audience'),
  platforms: jsonb('platforms'), // Array of platform names
  contentCalendar: jsonb('content_calendar'), // Schedule of posts
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  status: varchar('status', { length: 50 }).default('draft'), // draft, scheduled, active, completed
  budget: integer('budget'), // Budget in cents or base units
  estimatedReach: integer('estimated_reach'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CampaignSchedule = InferSelectModel<typeof campaignSchedules>;

