import {
  defineProduct,
  z,
  Strategy,
  Asset,
  system,
  asJson,
  loadDoc,
  makeAsset,
  readVoiceCorpus,
  writeFile,
  today,
} from "@mm/core";

const Input = z.object({
  voice: z.string().optional().describe("Voice id from client.yaml; defaults to the first voice"),
  channel: z.enum(["linkedin", "instagram", "newsletter", "x"]).default("linkedin"),
  count: z.number().int().min(1).max(10).default(3),
  topics: z.array(z.string()).optional(),
  notes: z.string().optional().describe("Raw notes / voice-memo transcript from the person to build posts from"),
});

const Post = z.object({
  format: z.enum(["text", "document", "carousel", "video_script", "newsletter"]),
  topic: z.string(),
  hook: z.string(),
  body: z.string(),
  cta: z.string().optional(),
  tlaCandidate: z.boolean().describe("Worth amplifying as a LinkedIn Thought Leader Ad if it performs organically"),
});
const Answer = z.object({ posts: z.array(Post) });

export default defineProduct({
  manifest: {
    id: "voice",
    name: "Voice",
    job: "Ghostwrite for named people (founders, team) in their own voice, on a fixed set of topics, for LinkedIn, Instagram and newsletters.",
    defaultAutonomy: "A2",
    defaultSchedule: "0 8 * * 1 (weekly drafts)",
    reads: ["client.yaml voices", "voice/<id>.md", "research/strategy.json", "assets(kind=post)"],
    writes: ["assets(kind=post, voice=<id>) always A2", "out/voice/<date>-<voice>.md"],
    connectors: ["Google Drive / Gmail (to send drafts)", "Claude Docs"],
    apis: [],
    skill: {
      gather: [
        "If the person left notes or a voice memo transcript, pass it via --input notes.",
        "Keep voice/<id>.md fresh: paste 10-20 of their best real posts or messages there.",
      ],
      act: [
        "Run `mm run voice --client <slug> --input '{\"voice\":\"param\",\"count\":3}'`.",
        "Email the drafts to the person. They edit and post themselves. Record their final text with `mm approve <id> --final <file>` so the edit distance trains the next run.",
      ],
    },
    evidence: ["07-social-short-form", "01-demand-creation", "08-positioning-messaging"],
  },
  input: Input,

  async gather(ctx, input) {
    const voice = ctx.client.voices.find((v) => v.id === input.voice) ?? ctx.client.voices[0];
    if (!voice) throw new Error(`${ctx.client.slug} has no voices in client.yaml`);
    const corpus = readVoiceCorpus(ctx.client.slug, voice.id).slice(0, 12000);
    const strategy = loadDoc(ctx, "strategy", Strategy);
    const recent = (await ctx.store.list<Asset>("assets", (a) => a.kind === "post" && a.voice === voice.id)).slice(-12);
    return { voice, corpus, positioning: strategy?.positioning, recentTopics: recent.map((r) => `${r.tags.segment ?? ""} ${r.title}`) };
  },

  think(ctx, input, ev) {
    return {
      name: "voice.posts",
      schema: Answer,
      system: system(ctx, `Voice, ghostwriter for ${ev.voice.name} (${ev.voice.role})`, ["social", "demand", "positioning"], [
        `Write as ${ev.voice.name}, first person. Match the rhythm, vocabulary and opinions in the corpus. If the corpus is thin, write plainly and briefly.`,
        ...ev.voice.rules,
        "Stay inside 2-3 fixed topics (topic fingerprinting beats variety for reach on LinkedIn). No hashtags beyond 2. No polls. No engagement bait.",
        "Cut any line that exists to sound good rather than to say something. Specific beats inspirational.",
        "LinkedIn: prefer document/carousel posts for reach and saves; text posts for opinions. Every post earns a save or a reply.",
      ]),
      prompt: [
        `Channel: ${input.channel}. Write ${input.count} posts.`,
        input.topics ? `Topics: ${input.topics.join("; ")}` : "",
        input.notes ? asJson("raw_notes_from_the_person", input.notes) : "",
        asJson("voice_corpus", ev.corpus || "(empty: ask the person for samples)"),
        asJson("positioning", ev.positioning ?? "none yet"),
        asJson("recent_posts_do_not_repeat", ev.recentTopics),
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, ev, answer) {
    const { posts } = Answer.parse(answer);
    const assets = posts.map((p) =>
      makeAsset(ctx, "voice", {
        kind: "post",
        channel: input.channel,
        voice: ev.voice.id,
        title: p.hook.slice(0, 90),
        body: `${p.hook}\n\n${p.body}${p.cta ? `\n\n${p.cta}` : ""}`,
        tags: { format: p.format, segment: p.topic },
        meta: { tlaCandidate: p.tlaCandidate },
      }),
    );
    await ctx.store.insertMany("assets", assets);
    writeFile(
      ctx.path("out", "voice", `${today()}-${ev.voice.id}-${input.channel}.md`),
      [`# ${ev.voice.name} · ${input.channel} drafts · ${today()}`, ...assets.map((a) => `## \`${a.id}\` · ${a.tags.format} · ${a.tags.segment}\n\n${a.body}`)].join("\n\n---\n\n"),
    );
    return assets;
  },

  summarize: (a) => `${a.length} drafts for ${a[0]?.voice ?? "?"}`,
});
