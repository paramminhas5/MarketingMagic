// Lead Desk: every inbound lead gets coded, scored, routed and a reply drafted.
// The instant acknowledgement happens in supabase/functions/lead-intake (seconds);
// this product does the thinking pass right after.
import { defineProduct, z, Lead, HdyhauChannel, Strategy, system, asJson, loadDoc, makeAsset, newId, tools } from "@mm/core";

const Input = z.object({
  lead: z.object({
    id: z.string().optional(),
    source: z.string().default("form"),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    message: z.string().optional(),
    hdyhau: z.string().optional(),
    utm: z.record(z.string(), z.string()).default({}),
  }).optional().describe("A single lead; omit to process every lead with status 'new'"),
});

const Answer = z.object({
  results: z.array(
    z.object({
      leadId: z.string(),
      hdyhauCoded: HdyhauChannel,
      fitScore: z.number().min(0).max(100),
      intentScore: z.number().min(0).max(100),
      route: z.enum(["hot", "nurture", "disqualify"]),
      reason: z.string(),
      reply: z.string().describe("Short, human first reply in the founder's voice, with one question that qualifies"),
      replyChannel: z.enum(["email", "whatsapp", "call"]),
    }),
  ),
});

export default defineProduct({
  manifest: {
    id: "lead-desk",
    name: "Lead Desk",
    job: "Code 'how did you hear about us', score fit and intent, route every lead and draft a fast human reply.",
    defaultAutonomy: "A1",
    defaultSchedule: "event (lead-intake webhook) + */30 * * * * sweep",
    reads: ["leads(status=new)", "research/strategy.json"],
    writes: ["leads (coded, scored, routed)", "assets(kind=reply)", "alerts for hot leads"],
    connectors: ["Gmail (reply)", "Google Calendar (book)", "Apollo (enrich)", "WhatsApp BSP (when connected)"],
    apis: ["MM_ALERT_WEBHOOK"],
    skill: {
      gather: ["New leads arrive via the lead-intake function into the store; or `mm import lead <file>`."],
      act: [
        "Run `mm run lead-desk --client <slug>`.",
        "Hot leads: send the drafted reply now (Gmail) and offer two calendar slots (Google Calendar suggest_time). Nurture: hand to Lifecycle. Anything about pricing or proposals: hand to a human.",
      ],
    },
    evidence: ["05-conversion", "09-analytics-attribution"],
  },
  input: Input,

  async gather(ctx, input) {
    if (input.lead) {
      const lead: Lead = Lead.parse({
        id: input.lead.id ?? newId("lead"),
        client: ctx.client.slug,
        source: input.lead.source,
        name: input.lead.name,
        email: input.lead.email,
        phone: input.lead.phone,
        company: input.lead.company,
        message: input.lead.message,
        hdyhauRaw: input.lead.hdyhau,
        utm: input.lead.utm,
        createdAt: new Date().toISOString(),
      });
      if (!(await ctx.store.get("leads", lead.id))) await ctx.store.insert("leads", lead);
    }
    const leads = await ctx.store.list<Lead>("leads", (l) => l.status === "new" && !l.route);
    const strategy = loadDoc(ctx, "strategy", Strategy);
    return { leads, bestFit: strategy?.positioning.bestFitCustomer ?? ctx.client.icp ?? "" };
  },

  think(ctx, _input, ev) {
    if (!ev.leads.length) return undefined;
    return {
      name: "lead-desk.triage",
      schema: Answer,
      system: system(ctx, "Lead Desk, who answers every lead within minutes", ["conversion"], [
        "Code the free-text 'how did you hear about us' answer into one channel; if it names a person, podcast, post or AI assistant, pick that channel.",
        "Hot = good fit AND clear intent (asked for price, timing, a call, tickets). Disqualify only when clearly outside the offer.",
        "Replies: 40-90 words, plain, first name only, one qualifying question, no links unless they asked.",
      ]),
      prompt: [asJson("best_fit_customer", ev.bestFit), asJson("offers", ctx.client.offers), asJson("leads", ev.leads)].join("\n\n"),
      tier: "fast",
    };
  },

  async finish(ctx, _input, ev, answer) {
    if (!answer) return { processed: 0, hot: 0 };
    const { results } = Answer.parse(answer);
    let hot = 0;
    for (const r of results) {
      const lead = ev.leads.find((l) => l.id === r.leadId);
      if (!lead) continue;
      await ctx.store.update<Lead>("leads", lead.id, {
        hdyhauCoded: r.hdyhauCoded,
        fitScore: r.fitScore,
        intentScore: r.intentScore,
        route: r.route,
        status: r.route === "disqualify" ? "lost" : "contacted",
      });
      await ctx.store.insert(
        "assets",
        makeAsset(ctx, "lead-desk", { kind: "reply", channel: r.replyChannel, title: `Reply to ${lead.name ?? lead.email ?? lead.phone ?? lead.id}`, body: r.reply, meta: { leadId: lead.id, route: r.route, reason: r.reason } }),
      );
      if (r.route === "hot") {
        hot++;
        await tools.alert(`🔥 ${ctx.client.name}: hot lead ${lead.name ?? ""} ${lead.email ?? lead.phone ?? ""} · ${r.reason}`);
      }
    }
    return { processed: results.length, hot };
  },

  summarize: (o) => `${o.processed} leads triaged, ${o.hot} hot`,
});
