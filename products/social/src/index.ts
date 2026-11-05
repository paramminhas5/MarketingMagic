import { defineProduct, z, Strategy, Asset, system, asJson, requireDoc, makeAsset, writeFile, today } from "@mm/core";

const Input = z.object({
  weeks: z.number().int().min(1).max(4).default(1),
  channels: z.array(z.enum(["instagram", "tiktok", "youtube_shorts", "linkedin_page", "x"])).default(["instagram"]),
  calendar: z.string().optional().describe("Events, drops or launches in this window"),
});

const Item = z.object({
  day: z.string().describe("YYYY-MM-DD"),
  channel: z.string(),
  format: z.enum(["carousel", "reel", "short", "static", "story", "text"]),
  pillar: z.string(),
  motivationId: z.string().optional(),
  hook: z.string(),
  caption: z.string(),
  production: z.string().describe("What to shoot or design, step by step"),
  visualPrompt: z.string().optional(),
  goal: z.enum(["reach", "saves", "shares", "clicks", "list_growth"]),
});
const Answer = z.object({ pillars: z.array(z.string()), items: z.array(Item) });

export default defineProduct({
  manifest: {
    id: "social",
    name: "Social",
    job: "Plan and write brand-channel content that earns reach (Reels/TikTok) and saves (carousels), tied to the strategy's pillars.",
    defaultAutonomy: "A1",
    defaultSchedule: "0 10 * * 5 (plans next week)",
    reads: ["research/strategy.json", "assets(kind=post, voice=brand)"],
    writes: ["assets(kind=post, voice=brand)", "out/social/<date>.md"],
    connectors: ["Magnific / Canva (visuals)", "Meta Ads (boost winning IG posts)", "Publishing tool TBD"],
    apis: [],
    skill: {
      gather: ["Pass upcoming events/drops via --input calendar."],
      act: [
        "Run `mm run social --client <slug>`.",
        "Generate visuals for items with a visualPrompt (Magnific/Canva).",
        "After Gatekeeper, schedule posts. Boost any post beating the account median on saves/shares by 2x (paid rules apply).",
      ],
    },
    evidence: ["07-social-short-form"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    const recent = (await ctx.store.list<Asset>("assets", (a) => a.product === "social")).slice(-20).map((a) => a.title);
    return { strategy, recent };
  },

  think(ctx, input, ev) {
    return {
      name: "social.plan",
      schema: Answer,
      system: system(ctx, "Social, a short-form content lead", ["social"], [
        "Carousels for saves and depth, Reels/TikTok for reach and shares, Shorts as cheap redistribution. Single images are dying.",
        "Reels under 30s for new audiences; 60-90s for engagement with existing ones.",
        "Every item has a reason to exist (goal) and a hook that works with sound off.",
        "3-5 content pillars max, rotated. Rotate motivations from the matrix too.",
      ]),
      prompt: [
        `Plan ${input.weeks} week(s) starting ${today()} for: ${input.channels.join(", ")}.`,
        input.calendar ? `Calendar: ${input.calendar}` : "",
        asJson("motivations", ev.strategy.motivations),
        asJson("recent_do_not_repeat", ev.recent),
      ].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, answer) {
    const a = Answer.parse(answer);
    const assets = a.items.map((it) =>
      makeAsset(ctx, "social", {
        kind: "post",
        channel: it.channel,
        title: it.hook.slice(0, 90),
        body: `${it.hook}\n\n${it.caption}`,
        tags: { format: it.format, motivation: it.motivationId, segment: it.pillar },
        meta: { day: it.day, production: it.production, visualPrompt: it.visualPrompt, goal: it.goal },
      }),
    );
    await ctx.store.insertMany("assets", assets);
    writeFile(
      ctx.path("out", "social", `${today()}.md`),
      [
        `# Social plan · ${ctx.client.name} · from ${today()}`,
        `Pillars: ${a.pillars.join(" · ")}`,
        `| day | channel | format | pillar | hook | goal | id |\n|---|---|---|---|---|---|---|\n${a.items.map((it, i) => `| ${it.day} | ${it.channel} | ${it.format} | ${it.pillar} | ${it.hook} | ${it.goal} | ${assets[i].id} |`).join("\n")}`,
        ...a.items.map((it, i) => `## ${it.day} · ${it.format} · \`${assets[i].id}\`\n**${it.hook}**\n\n${it.caption}\n\n_Production:_ ${it.production}${it.visualPrompt ? `\n\n\`\`\`\n${it.visualPrompt}\n\`\`\`` : ""}`),
      ].join("\n\n"),
    );
    return assets;
  },

  summarize: (a) => `${a.length} social posts planned`,
});
