import { defineProduct, z, MarketBrief, Strategy, system, asJson, requireDoc, loadDoc, readInputs, makeAsset, writeFile, today, tools } from "@mm/core";

const Input = z.object({ pages: z.number().int().min(1).max(20).default(5) });

const Answer = z.object({
  targetQueries: z.array(
    z.object({
      query: z.string(),
      intent: z.enum(["commercial", "transactional", "navigational", "informational"]),
      aiOverviewLikely: z.boolean(),
      priority: z.number().int().min(1).max(5),
      why: z.string(),
    }),
  ),
  pages: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      type: z.enum(["case_study", "comparison", "pricing", "faq", "pillar", "location", "use_case", "integration"]),
      targetQueries: z.array(z.string()),
      outline: z.array(z.string()),
      proofNeeded: z.array(z.string()).describe("Real numbers, quotes, screenshots the client must supply"),
      schemaTypes: z.array(z.string()),
    }),
  ),
  seedingBriefs: z.array(
    z.object({
      surface: z.enum(["reddit", "linkedin", "youtube", "g2", "clutch", "quora", "wikipedia", "industry_press", "podcast", "directory"]),
      target: z.string().describe("Thread, list, publication or profile"),
      angle: z.string(),
      starterDraft: z.string(),
      disclosure: z.string().describe("How the real person discloses their affiliation"),
    }),
  ),
  aiPromptsToTrack: z.array(z.string()).describe("Questions a buyer would ask ChatGPT/Perplexity/AI Overviews where the client should be cited"),
  technical: z.array(z.string()).describe("Schema, llms.txt, internal links, speed fixes"),
});

export default defineProduct({
  manifest: {
    id: "search",
    name: "Search",
    job: "Win citations in AI answers and rankings on commercial queries: target queries, page briefs, third-party seeding briefs, prompts to track.",
    defaultAutonomy: "A2",
    defaultSchedule: "0 7 1 * * (monthly) + citation check weekly",
    reads: ["research/market-brief.json", "research/strategy.json", "inputs/search/*"],
    writes: ["assets(kind=article)", "assets(kind=seeding_brief) human-only", "out/search/<date>.md"],
    connectors: ["Ahrefs (keywords, Brand Radar AI share of voice, GSC)", "Semrush", "Vercel (publish pages)"],
    apis: [],
    skill: {
      gather: [
        "Ahrefs: gsc-keywords + gsc-pages for the client site (if connected), keywords-explorer-matching-terms for the category; save to inputs/search/ahrefs.json",
        "Ahrefs Brand Radar: AI share of voice + cited pages/domains for the category prompts; save to inputs/search/ai-citations.json",
        "Semrush: organic_research for top 3 competitors; save to inputs/search/semrush.json",
      ],
      act: [
        "Run `mm run search --client <slug>`.",
        "Pages briefs go to Pages (landing) or get written by a human expert with AI help. Seeding briefs are for a real person to act on under their own account, with disclosure. Never post as anyone else.",
        "Register aiPromptsToTrack in Ahrefs Brand Radar (management-brand-radar-prompts-create).",
      ],
    },
    evidence: ["02-inbound-seo-geo", "09-analytics-attribution"],
  },
  input: Input,

  async gather(ctx) {
    const brief = requireDoc(ctx, "market-brief", MarketBrief, "Run Scout first.");
    const strategy = loadDoc(ctx, "strategy", Strategy);
    const site = ctx.client.url ? await tools.fetchText(ctx.client.url, 3000) : "";
    return { brief, positioning: strategy?.positioning, exports: readInputs(ctx.client.slug, "search"), site };
  },

  think(ctx, input, ev) {
    return {
      name: "search.plan",
      schema: Answer,
      system: system(ctx, "Search, an SEO and GEO lead", ["inbound", "analytics"], [
        "Optimise to be cited, not just ranked. AI Overviews cut top-result CTR ~58%; cited brands get more clicks. Prioritise commercial and non-AIO queries.",
        "No informational blog farms. Fewer pages, each with proof only this client has (numbers, cases, data).",
        "Reddit, LinkedIn, YouTube, G2/Clutch and Wikipedia drive citations. Seeding is done by real people with disclosure; drafts are starting points, not scripts.",
      ]),
      prompt: [`Plan up to ${input.pages} pages.`, asJson("market_brief", ev.brief), asJson("positioning", ev.positioning ?? "none"), asJson("site_text", ev.site), asJson("connector_exports", ev.exports)].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, answer) {
    const a = Answer.parse(answer);
    const pages = a.pages.map((p) =>
      makeAsset(ctx, "search", { kind: "article", channel: "web", title: p.title, body: p.outline.join("\n"), meta: { ...p } }),
    );
    const seeds = a.seedingBriefs.map((s) =>
      makeAsset(ctx, "search", { kind: "seeding_brief", channel: s.surface, title: `${s.surface}: ${s.target}`, body: s.starterDraft, meta: { angle: s.angle, disclosure: s.disclosure }, approval: { status: "pending", level: "A3" } }),
    );
    await ctx.store.insertMany("assets", [...pages, ...seeds]);
    writeFile(
      ctx.path("out", "search", `${today()}.md`),
      [
        `# Search plan · ${ctx.client.name} · ${today()}`,
        `## Target queries\n| p | query | intent | AIO likely | why |\n|---|---|---|---|---|\n${a.targetQueries.sort((x, y) => y.priority - x.priority).map((q) => `| ${q.priority} | ${q.query} | ${q.intent} | ${q.aiOverviewLikely ? "yes" : "no"} | ${q.why} |`).join("\n")}`,
        `## Pages\n${a.pages.map((p) => `### ${p.title} (/${p.slug}) · ${p.type}\nQueries: ${p.targetQueries.join("; ")}\n\n${p.outline.map((o) => `- ${o}`).join("\n")}\n\n**Proof needed:** ${p.proofNeeded.join("; ")}\n\n**Schema:** ${p.schemaTypes.join(", ")}`).join("\n\n")}`,
        `## Seeding briefs (for a real person, with disclosure)\n${a.seedingBriefs.map((s) => `### ${s.surface}: ${s.target}\n${s.angle}\n\n> ${s.starterDraft}\n\n_Disclosure:_ ${s.disclosure}`).join("\n\n")}`,
        `## AI prompts to track\n${a.aiPromptsToTrack.map((p) => `- ${p}`).join("\n")}`,
        `## Technical\n${a.technical.map((t) => `- ${t}`).join("\n")}`,
      ].join("\n\n"),
    );
    return a;
  },

  summarize: (a) => `${a.targetQueries.length} queries, ${a.pages.length} page briefs, ${a.seedingBriefs.length} seeding briefs`,
});
