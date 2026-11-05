// The contracts every product speaks. Products never pass prose to each other:
// they read and write these records. Change a contract here and every product
// that touches it fails typecheck, which is the point.
import { z } from "zod";

export const Playbook = z.enum(["consumer", "b2b_service", "creator_media"]);
export type Playbook = z.infer<typeof Playbook>;

export const Autonomy = z.enum(["A0", "A1", "A2", "A3"]);
export type Autonomy = z.infer<typeof Autonomy>;
// A0 auto · A1 auto within guardrails · A2 human approves · A3 human only

export const Confidence = z.enum(["low", "medium", "high"]);

export const PRODUCT_IDS = [
  "scout",
  "strategist",
  "architect",
  "studio",
  "voice",
  "social",
  "search",
  "pages",
  "media-buyer",
  "hunter",
  "lifecycle",
  "lead-desk",
  "gatekeeper",
  "analyst",
] as const;
export const ProductId = z.enum(PRODUCT_IDS);
export type ProductId = z.infer<typeof ProductId>;

// ---------------------------------------------------------------- client

export const Voice = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  channels: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
});
export type Voice = z.infer<typeof Voice>;

export const ClientProfile = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  url: z.string().optional(),
  playbook: Playbook,
  description: z.string(),
  geo: z.array(z.string()).default([]),
  icp: z.string().optional(),
  offers: z
    .array(z.object({ name: z.string(), price: z.string().optional(), description: z.string() }))
    .default([]),
  competitors: z.array(z.string()).default([]),
  voices: z.array(Voice).default([]),
  brand: z
    .object({
      tone: z.string().optional(),
      rules: z.array(z.string()).default([]),
      banned: z.array(z.string()).default([]),
      colors: z.array(z.string()).default([]),
    })
    .default({ rules: [], banned: [], colors: [] }),
  accounts: z.record(z.string(), z.string()).default({}),
  constraints: z.array(z.string()).default([]),
  currency: z.string().default("INR"),
});
export type ClientProfile = z.infer<typeof ClientProfile>;

// ---------------------------------------------------------------- research

export const MarketBrief = z.object({
  summary: z.string(),
  category: z.string(),
  competitors: z.array(
    z.object({
      name: z.string(),
      url: z.string().optional(),
      angle: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      channels: z.array(z.string()),
    }),
  ),
  audience: z.array(
    z.object({
      segment: z.string(),
      pains: z.array(z.string()),
      desires: z.array(z.string()),
      objections: z.array(z.string()),
      whereTheyAre: z.array(z.string()),
    }),
  ),
  languageBank: z.array(z.object({ phrase: z.string(), source: z.string() })),
  searchLandscape: z.object({
    commercialQueries: z.array(z.string()),
    aiAnswerGaps: z.array(z.string()),
    citationSurfaces: z.array(z.string()),
  }),
  opportunities: z.array(
    z.object({ opportunity: z.string(), evidence: z.string(), confidence: Confidence }),
  ),
  unverified: z.array(z.string()).describe("Things you could not confirm from the evidence given"),
});
export type MarketBrief = z.infer<typeof MarketBrief>;

// ---------------------------------------------------------------- strategy

export const Motivation = z.object({
  id: z.string().describe("short kebab id, e.g. scarcity-drop"),
  name: z.string(),
  insight: z.string(),
  proofPoints: z.array(z.string()),
  segments: z.array(z.string()),
});
export type Motivation = z.infer<typeof Motivation>;

export const Strategy = z.object({
  positioning: z.object({
    competitiveAlternatives: z.array(z.string()),
    uniqueAttributes: z.array(z.string()),
    value: z.array(z.string()),
    bestFitCustomer: z.string(),
    marketCategory: z.string(),
    statement: z.string(),
  }),
  motivations: z.array(Motivation).min(3),
  offers: z.array(
    z.object({ name: z.string(), hypothesis: z.string(), structure: z.string(), risk: z.string() }),
  ),
  channels: z.array(
    z.object({
      channel: z.string(),
      role: z.enum(["demand", "capture", "convert", "retain"]),
      budgetShare: z.number().min(0).max(1),
      kpi: z.string(),
      cadence: z.string(),
    }),
  ),
  primaryMetric: z.object({ name: z.string(), target: z.string() }),
  tests: z.array(
    z.object({
      hypothesis: z.string(),
      metric: z.string(),
      minSample: z.string(),
      killRule: z.string(),
    }),
  ),
  risks: z.array(z.string()),
});
export type Strategy = z.infer<typeof Strategy>;

// ---------------------------------------------------------------- machine

export const MachineProduct = z.object({
  id: ProductId,
  enabled: z.boolean(),
  schedule: z.string().describe("cron (5-field, client timezone), 'event', or 'on-demand'"),
  autonomy: Autonomy,
  caps: z.record(z.string(), z.number()).default({}),
  notes: z.string().default(""),
});
export type MachineProduct = z.infer<typeof MachineProduct>;

export const Machine = z.object({
  client: z.string(),
  timezone: z.string().default("Asia/Kolkata"),
  products: z.array(MachineProduct),
  budgets: z.object({
    currency: z.string(),
    monthlyPaid: z.number(),
    dailyCap: z.number(),
  }),
  approvers: z.array(z.string()),
  kpis: z.array(z.object({ name: z.string(), target: z.string() })),
  weeklyRhythm: z.array(z.string()),
});
export type Machine = z.infer<typeof Machine>;

// ---------------------------------------------------------------- assets

export const AssetKind = z.enum([
  "strategy",
  "machine",
  "ad",
  "post",
  "page",
  "email",
  "sequence",
  "flow",
  "article",
  "seeding_brief",
  "reply",
  "campaign_plan",
]);
export type AssetKind = z.infer<typeof AssetKind>;

export const Asset = z.object({
  id: z.string(),
  client: z.string(),
  product: ProductId,
  kind: AssetKind,
  channel: z.string(),
  voice: z.string().default("brand").describe("'brand', 'creator', or a voice id like 'param'"),
  title: z.string(),
  body: z.string(),
  tags: z
    .object({
      motivation: z.string().optional(),
      concept: z.string().optional(),
      format: z.string().optional(),
      hook: z.string().optional(),
      segment: z.string().optional(),
      campaign: z.string().optional(),
    })
    .default({}),
  aiLevel: z.enum(["ai", "hybrid", "human"]).default("ai"),
  meta: z.record(z.string(), z.unknown()).default({}),
  gate: z
    .object({
      status: z.enum(["pending", "passed", "failed"]),
      reasons: z.array(z.string()).default([]),
      humanFeel: z.number().optional(),
    })
    .default({ status: "pending", reasons: [] }),
  approval: z
    .object({
      status: z.enum(["pending", "approved", "rejected", "auto"]),
      level: Autonomy,
      by: z.string().optional(),
      at: z.string().optional(),
      editDistance: z.number().optional(),
      note: z.string().optional(),
    })
    .default({ status: "pending", level: "A2" }),
  live: z.object({ platform: z.string(), externalId: z.string() }).optional(),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof Asset>;

// ---------------------------------------------------------------- leads

export const HdyhauChannel = z.enum([
  "instagram",
  "linkedin",
  "founder_content",
  "friend_word_of_mouth",
  "event",
  "google_search",
  "ai_assistant",
  "paid_social",
  "email_newsletter",
  "whatsapp",
  "podcast_youtube",
  "community_reddit",
  "outbound",
  "press",
  "other",
  "unknown",
]);
export type HdyhauChannel = z.infer<typeof HdyhauChannel>;

export const Lead = z.object({
  id: z.string(),
  client: z.string(),
  source: z.string().default("form"),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  message: z.string().optional(),
  utm: z.record(z.string(), z.string()).default({}),
  hdyhauRaw: z.string().optional(),
  hdyhauCoded: HdyhauChannel.optional(),
  fitScore: z.number().optional(),
  intentScore: z.number().optional(),
  route: z.enum(["hot", "nurture", "disqualify"]).optional(),
  status: z.enum(["new", "contacted", "qualified", "booked", "won", "lost"]).default("new"),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof Lead>;

// ---------------------------------------------------------------- performance + learning

export const MetricRow = z.object({
  id: z.string(),
  client: z.string(),
  date: z.string(),
  channel: z.string(),
  entityId: z.string(),
  entityName: z.string().default(""),
  assetId: z.string().optional(),
  spend: z.number().default(0),
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  results: z.number().default(0),
  revenue: z.number().default(0),
  frequency: z.number().optional(),
});
export type MetricRow = z.infer<typeof MetricRow>;

export const Learning = z.object({
  id: z.string(),
  client: z.string(),
  claim: z.string(),
  evidence: z.string(),
  scope: z.enum(["brand", "vertical", "global"]),
  confidence: Confidence,
  createdAt: z.string(),
});
export type Learning = z.infer<typeof Learning>;

export const RunLog = z.object({
  id: z.string(),
  client: z.string(),
  product: ProductId,
  status: z.enum(["done", "pending_llm", "failed"]),
  summary: z.string(),
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  ms: z.number().default(0),
  createdAt: z.string(),
});
export type RunLog = z.infer<typeof RunLog>;
