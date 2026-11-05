import {
  defineProduct,
  z,
  Strategy,
  Asset,
  system,
  asJson,
  requireDoc,
  makeAsset,
  writeFile,
  today,
} from "@mm/core";

const Input = z.object({
  count: z.number().int().min(3).max(50).default(15),
  campaign: z.string().default("always-on"),
  offer: z.string().optional(),
  formats: z.array(z.string()).default(["static", "video", "carousel", "founder_talking_head", "ugc_script"]),
});

const Concept = z.object({
  motivationId: z.string(),
  concept: z.string().describe("The single idea, in one line"),
  hookType: z.enum(["question", "bold_claim", "pattern_interrupt", "pov", "proof_first", "story", "demo", "list"]),
  format: z.string(),
  hook: z.string().describe("First line / first 2 seconds"),
  headline: z.string(),
  primaryText: z.string(),
  cta: z.string(),
  script: z.string().describe("Shot list or VO script for video formats; layout notes for statics"),
  visualPrompt: z.string().describe("A ready-to-run image/video generation prompt (Magnific, Midjourney, Higgsfield)"),
  whoShouldRecord: z.string().describe("'none' for generated, or the real person to film it (founder, creator, customer)"),
});

const Answer = z.object({ concepts: z.array(Concept) });

export default defineProduct({
  manifest: {
    id: "studio",
    name: "Studio",
    job: "Produce genuinely distinct paid-ad concepts across the motivation matrix, with copy, scripts and ready-to-run visual prompts.",
    defaultAutonomy: "A1",
    defaultSchedule: "0 9 * * 1 (weekly) + on fatigue/kill briefs from Analyst",
    reads: ["research/strategy.json", "assets(kind=ad)", "learnings"],
    writes: ["assets(kind=ad, gate=pending)", "out/studio/<date>-<campaign>.md"],
    connectors: ["Magnific (images, video, TTS, upscale)", "Canva (templated statics, resizes)", "Meta Ads (ads_creative_create_image_variations)"],
    apis: [],
    skill: {
      gather: ["Check `mm approvals` so you know which concepts are already live or queued."],
      act: [
        "Run `mm run studio --client <slug> --input '{\"count\":15,\"campaign\":\"<name>\"}'`.",
        "For each concept with whoShouldRecord = none: generate the visual with Magnific (images_generate / video_generate) from visualPrompt; save the creation URL into the asset's meta via `mm asset <id> --meta url=<url>`.",
        "For founder/creator formats: send the script to that person; they record, you upload.",
        "Then run Gatekeeper.",
      ],
    },
    evidence: ["03-paid-acquisition", "10-ai-native-marketing-ops"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Scout and Strategist first.");
    const existing = await ctx.store.list<Asset>("assets", (a) => a.kind === "ad" && a.approval.status !== "rejected");
    const learnings = (await ctx.store.list<{ id: string; client: string; claim: string }>("learnings")).slice(-20).map((l) => l.claim);
    return {
      strategy,
      existing: existing.map((a) => ({ motivation: a.tags.motivation, hook: a.tags.hook, format: a.tags.format, title: a.title })),
      learnings,
    };
  },

  think(ctx, input, ev) {
    const perMotivation = Math.ceil(input.count / ev.strategy.motivations.length);
    return {
      name: "studio.concepts",
      schema: Answer,
      system: system(ctx, "Studio, a performance creative director", ["paid", "aiOps", "social"], [
        `Return exactly ${input.count} concepts. Spread them across ALL motivations (about ${perMotivation} each) and across these formats: ${input.formats.join(", ")}.`,
        "Two concepts on the same motivation must differ in concept AND hook type. Colour or CTA swaps are not new concepts: Meta counts look-alikes as one ad.",
        "Founder talking-head and UGC scripts outperform polish under Andromeda: write them as spoken, imperfect, first person.",
        "Generated visuals must not look AI-made: real textures, real places, real people doing real things; no glossy 3D blobs, no text baked into images.",
        "Do not repeat anything in `existing`. Lean into what `learnings` says works.",
      ]),
      prompt: [
        `Campaign: ${input.campaign}`,
        input.offer ? `Offer: ${input.offer}` : "",
        asJson("motivation_matrix", ev.strategy.motivations),
        asJson("positioning", ev.strategy.positioning),
        asJson("existing", ev.existing),
        asJson("learnings", ev.learnings),
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, _ev, answer) {
    const { concepts } = Answer.parse(answer);
    const assets = concepts.map((c, i) =>
      makeAsset(ctx, "studio", {
        kind: "ad",
        channel: "meta",
        title: c.headline,
        body: `${c.hook}\n\n${c.primaryText}`,
        tags: { motivation: c.motivationId, concept: c.concept, format: c.format, hook: c.hookType, campaign: input.campaign },
        meta: { cta: c.cta, script: c.script, visualPrompt: c.visualPrompt, whoShouldRecord: c.whoShouldRecord, n: i + 1 },
      }),
    );
    await ctx.store.insertMany("assets", assets);
    const md = [
      `# Studio · ${ctx.client.name} · ${input.campaign} · ${today()}`,
      ...assets.map(
        (a) =>
          `## ${a.meta.n}. ${a.title}\n\`${a.id}\` · motivation **${a.tags.motivation}** · ${a.tags.format} · hook: ${a.tags.hook}\n\n**Hook:** ${concepts[(a.meta.n as number) - 1].hook}\n\n**Primary text:** ${concepts[(a.meta.n as number) - 1].primaryText}\n\n**CTA:** ${a.meta.cta}\n\n**Script / layout:**\n${a.meta.script}\n\n**Visual prompt:**\n\`\`\`\n${a.meta.visualPrompt}\n\`\`\`\n**Who records:** ${a.meta.whoShouldRecord}`,
      ),
    ].join("\n\n");
    writeFile(ctx.path("out", "studio", `${today()}-${input.campaign}.md`), md);
    return assets;
  },

  summarize: (assets) => `${assets.length} ad concepts across ${new Set(assets.map((a) => a.tags.motivation)).size} motivations`,
});
