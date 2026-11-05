import { defineProduct, z, Strategy, system, asJson, requireDoc, makeAsset, writeFile, today } from "@mm/core";

const Input = z.object({
  flows: z.array(z.string()).optional().describe("Override which flows to write, e.g. ['welcome','post_event']"),
  channels: z.array(z.enum(["email", "whatsapp", "sms"])).default(["email", "whatsapp"]),
});

const Flow = z.object({
  name: z.string(),
  trigger: z.string(),
  exitWhen: z.string(),
  goal: z.string(),
  steps: z.array(
    z.object({
      delayHours: z.number(),
      channel: z.enum(["email", "whatsapp", "sms"]),
      messageType: z.enum(["utility", "marketing"]).describe("WhatsApp category; utility is ~7x cheaper in India"),
      subject: z.string().optional(),
      body: z.string(),
    }),
  ),
  kpi: z.string(),
});
const Answer = z.object({ flows: z.array(Flow) });

const DEFAULTS = {
  consumer: ["welcome", "abandoned_cart", "browse_abandonment", "back_in_stock_or_drop", "post_purchase", "win_back"],
  b2b_service: ["lead_nurture_to_call", "no_show_recovery", "post_call_follow_up", "closed_lost_reactivation"],
  creator_media: ["welcome", "event_drop", "post_event_next_one", "referral", "lapsed_fan_win_back"],
} as const;

export default defineProduct({
  manifest: {
    id: "lifecycle",
    name: "Lifecycle",
    job: "Write the automated flows that turn every captured contact into revenue: welcome, cart, drop, post-event, nurture, win-back.",
    defaultAutonomy: "A1",
    defaultSchedule: "on-demand (flows) · runs are event-driven in the sending tool",
    reads: ["research/strategy.json", "client playbook"],
    writes: ["assets(kind=flow)", "out/lifecycle/<date>.md"],
    connectors: ["Klaviyo (when connected)", "WhatsApp BSP: Interakt/AiSensy/Gupshup (when connected)", "Gmail (interim)"],
    apis: [],
    skill: {
      gather: [],
      act: [
        "Run `mm run lifecycle --client <slug>`.",
        "After approval, build each flow in the sending tool. WhatsApp templates need Meta approval; submit utility vs marketing as labelled.",
      ],
    },
    evidence: ["06-lifecycle-retention", "05-conversion"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    return { strategy };
  },

  think(ctx, input, ev) {
    const flows = input.flows ?? [...DEFAULTS[ctx.client.playbook]];
    return {
      name: "lifecycle.flows",
      schema: Answer,
      system: system(ctx, "Lifecycle, a retention and CRM lead", ["lifecycle", "conversion"], [
        "Flows beat campaigns by 18-100x revenue per recipient. Multi-step beats single-step.",
        "Judge flows by placed-order / conversion rate and revenue per recipient, never opens.",
        "WhatsApp in India: keep messages short, one CTA, use utility category where the message is genuinely transactional.",
        "Don't label messages as AI-made content; don't fake urgency the client can't honour.",
      ]),
      prompt: [`Write these flows: ${flows.join(", ")}. Channels available: ${input.channels.join(", ")}.`, asJson("strategy", { positioning: ev.strategy.positioning, offers: ev.strategy.offers, motivations: ev.strategy.motivations })].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, answer) {
    const { flows } = Answer.parse(answer);
    const assets = flows.map((f) =>
      makeAsset(ctx, "lifecycle", {
        kind: "flow",
        channel: [...new Set(f.steps.map((s) => s.channel))].join("+"),
        title: f.name,
        body: f.steps.map((s, i) => `${i + 1}. +${s.delayHours}h ${s.channel}/${s.messageType}${s.subject ? ` · ${s.subject}` : ""}\n${s.body}`).join("\n\n"),
        meta: { trigger: f.trigger, exitWhen: f.exitWhen, goal: f.goal, kpi: f.kpi, steps: f.steps },
      }),
    );
    await ctx.store.insertMany("assets", assets);
    writeFile(
      ctx.path("out", "lifecycle", `${today()}.md`),
      [`# Lifecycle flows · ${ctx.client.name}`, ...flows.map((f, i) => `## ${f.name} \`${assets[i].id}\`\nTrigger: ${f.trigger} · Exit: ${f.exitWhen} · KPI: ${f.kpi}\n\n${assets[i].body}`)].join("\n\n"),
    );
    return assets;
  },

  summarize: (a) => `${a.length} flows`,
});
