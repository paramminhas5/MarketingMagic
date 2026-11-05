import {
  defineProduct,
  z,
  MarketBrief,
  system,
  asJson,
  saveDoc,
  readInputs,
  tools,
  bullets,
} from "@mm/core";

const Input = z.object({
  focus: z.string().optional().describe("Optional angle, e.g. 'ticketed events in Bengaluru'"),
  competitors: z.array(z.string()).optional().describe("URLs or names to add to the client's list"),
});

type Evidence = {
  site: string;
  competitorSites: Record<string, string>;
  connectorExports: Record<string, string>;
  adLibrary: unknown[];
};

export default defineProduct({
  manifest: {
    id: "scout",
    name: "Scout",
    job: "Build the factual picture of a market before anyone writes copy: competitors, audience language, search and AI-answer landscape.",
    defaultAutonomy: "A0",
    defaultSchedule: "on-demand (onboarding) + monthly refresh",
    reads: ["client.yaml", "inputs/scout/*"],
    writes: ["research/market-brief.json", "research/market-brief.md"],
    connectors: ["Ahrefs", "Semrush", "Meta Ads (Ad Library)", "Web search/fetch", "Google Drive"],
    apis: ["META_ACCESS_TOKEN (Ad Library)"],
    skill: {
      gather: [
        "Ahrefs: site-explorer-metrics + organic-keywords + organic-competitors for the client URL; save to inputs/scout/ahrefs.json",
        "Ahrefs Brand Radar (or web search of the category in ChatGPT/Perplexity-style queries): which brands and pages get cited for the client's category; save to inputs/scout/ai-answers.json",
        "Semrush: domain_overview + competitors_research; save to inputs/scout/semrush.json",
        "Meta Ads ads_library_search for each competitor and the category keyword (country of the client); save to inputs/scout/meta-ad-library.json",
        "Web search: reviews, Reddit/community threads and comments where the audience talks about the problem; save verbatim phrases with URLs to inputs/scout/voice-of-customer.md",
      ],
      act: ["Run `mm run scout --client <slug>`, then answer the pending thinking step if there is no API key."],
    },
    evidence: ["01-demand-creation", "02-inbound-seo-geo", "08-positioning-messaging"],
  },
  input: Input,

  async gather(ctx, input) {
    const site = ctx.client.url ? await tools.fetchText(ctx.client.url, 6000) : "";
    const comps = [...ctx.client.competitors, ...(input.competitors ?? [])].slice(0, 6);
    const competitorSites: Record<string, string> = {};
    for (const c of comps) if (c.startsWith("http")) competitorSites[c] = await tools.fetchText(c, 2500);
    let adLibrary: unknown[] = [];
    if (tools.hasMeta()) {
      const country = ctx.client.geo.some((g) => /india|bengaluru|mumbai|delhi/i.test(g)) ? "IN" : "US";
      for (const term of comps.filter((c) => !c.startsWith("http")).slice(0, 4)) {
        try {
          const r = (await tools.metaAdLibrary(term, country, 10)) as { data?: unknown[] };
          adLibrary.push({ term, ads: r.data ?? [] });
        } catch (e) {
          ctx.log(`ad library ${term}: ${(e as Error).message}`);
        }
      }
    }
    return { site, competitorSites, connectorExports: readInputs(ctx.client.slug, "scout"), adLibrary } satisfies Evidence;
  },

  think(ctx, input, ev: Evidence) {
    return {
      name: "scout.market-brief",
      schema: MarketBrief,
      system: system(ctx, "Scout, a market and audience researcher", ["demand", "inbound", "positioning"], [
        "Ground every competitor, phrase and opportunity in the evidence provided. Language-bank phrases must be verbatim from evidence, with the source.",
        "Anything you believe but could not confirm goes in `unverified`, not in the brief.",
        "Commercial queries should be ones a buyer types when ready to act, not informational ones (AI answers eat those).",
      ]),
      prompt: [
        input.focus ? `Focus: ${input.focus}` : "",
        asJson("client_site_text", ev.site),
        asJson("competitor_sites", ev.competitorSites),
        asJson("connector_exports", ev.connectorExports),
        asJson("meta_ad_library", ev.adLibrary),
        "Produce the market brief.",
      ].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, brief) {
    const b = MarketBrief.parse(brief);
    const md = [
      `# Market brief: ${ctx.client.name}`,
      `_${new Date().toISOString().slice(0, 10)} · Scout_`,
      `## Summary\n${b.summary}\n\n**Category:** ${b.category}`,
      `## Competitors\n${b.competitors
        .map((c) => `### ${c.name}${c.url ? ` (${c.url})` : ""}\n**Angle:** ${c.angle}\n\nStrengths:\n${bullets(c.strengths)}\n\nWeaknesses:\n${bullets(c.weaknesses)}\n\nChannels: ${c.channels.join(", ")}`)
        .join("\n\n")}`,
      `## Audience\n${b.audience
        .map((a) => `### ${a.segment}\nPains:\n${bullets(a.pains)}\n\nDesires:\n${bullets(a.desires)}\n\nObjections:\n${bullets(a.objections)}\n\nWhere they are: ${a.whereTheyAre.join(", ")}`)
        .join("\n\n")}`,
      `## Language bank\n${b.languageBank.map((l) => `- "${l.phrase}" (${l.source})`).join("\n")}`,
      `## Search and AI answers\nCommercial queries:\n${bullets(b.searchLandscape.commercialQueries)}\n\nAI-answer gaps:\n${bullets(b.searchLandscape.aiAnswerGaps)}\n\nCitation surfaces:\n${bullets(b.searchLandscape.citationSurfaces)}`,
      `## Opportunities\n${b.opportunities.map((o) => `- **${o.opportunity}** (${o.confidence}): ${o.evidence}`).join("\n")}`,
      `## Not verified\n${bullets(b.unverified)}`,
    ].join("\n\n");
    await saveDoc(ctx, "market-brief", b, md);
    return b;
  },

  summarize: (b) => `market brief: ${b.competitors.length} competitors, ${b.audience.length} segments, ${b.opportunities.length} opportunities`,
});
