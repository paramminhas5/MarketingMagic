// Gatekeeper: nothing reaches the outside world without passing here.
// Deterministic checks first (cheap, consistent), then one model review for the
// things rules can't see (does it sound human, are claims supported, policy risk).
import { defineProduct, z, Asset, system, asJson, copyIssues, tooSimilar, wordCount, ALWAYS_HUMAN } from "@mm/core";

const Input = z.object({ ids: z.array(z.string()).optional().describe("Asset ids; default: everything with gate=pending") });

const Answer = z.object({
  reviews: z.array(
    z.object({
      assetId: z.string(),
      humanFeel: z.number().int().min(1).max(5).describe("5 = indistinguishable from a sharp human; 1 = obviously AI"),
      genericPhrases: z.array(z.string()),
      unsupportedClaims: z.array(z.string()),
      policyRisks: z.array(z.string()).describe("Ad policy, platform rules, legal (health/finance claims, personal attributes, misleading urgency)"),
      verdict: z.enum(["pass", "fix", "fail"]),
      fix: z.string().optional().describe("Concrete rewrite instruction when verdict = fix"),
    }),
  ),
});

const LIMITS: Partial<Record<Asset["kind"], number>> = { ad: 180, post: 450, reply: 120, email: 200 };

export default defineProduct({
  manifest: {
    id: "gatekeeper",
    name: "Gatekeeper",
    job: "Check every asset before it ships: brand rules, AI tells, duplicate creative, unsupported claims, policy risk, and route it to auto or human approval.",
    defaultAutonomy: "A0",
    defaultSchedule: "after every production run + 0 * * * * sweep",
    reads: ["assets(gate=pending)", "assets(live or queued)", "client.yaml brand + voices", "machine autonomy"],
    writes: ["assets.gate", "assets.approval (auto | pending)"],
    connectors: ["Meta Ads (ads_get_ad_preview) for a visual check of ads"],
    apis: [],
    skill: {
      gather: [],
      act: ["Run `mm run gatekeeper --client <slug>` after any product creates assets. Then `mm approvals` shows what needs a human."],
    },
    evidence: ["10-ai-native-marketing-ops", "03-paid-acquisition", "04-outbound-leadgen"],
  },
  input: Input,

  async gather(ctx, input) {
    const all = await ctx.store.list<Asset>("assets");
    const queue = all.filter((a) => (input.ids ? input.ids.includes(a.id) : a.gate.status === "pending"));
    const others = all.filter((a) => a.gate.status === "passed" && a.approval.status !== "rejected");
    const ruleFindings: Record<string, string[]> = {};
    for (const a of queue) {
      const voice = ctx.client.voices.find((v) => v.id === a.voice);
      const noEmDash = Boolean(voice?.rules.some((r) => /em dash/i.test(r))) || ctx.client.brand.rules.some((r) => /em dash/i.test(r));
      const issues = copyIssues(`${a.title}\n${a.body}`, { banned: ctx.client.brand.banned, noEmDash });
      const dup = ["ad", "post"].includes(a.kind) ? tooSimilar(a, [...others, ...queue.filter((q) => q.createdAt < a.createdAt)]) : undefined;
      if (dup) issues.push(`too similar to ${dup.id} ("${dup.title.slice(0, 40)}"): Meta would treat it as the same ad`);
      const limit = LIMITS[a.kind];
      if (limit && wordCount(a.body) > limit) issues.push(`${wordCount(a.body)} words; limit for ${a.kind} is ${limit}`);
      ruleFindings[a.id] = issues;
    }
    return { queue, ruleFindings };
  },

  think(ctx, _input, ev) {
    const reviewable = ev.queue.filter((a) => !["strategy", "machine"].includes(a.kind));
    if (!reviewable.length) return undefined;
    return {
      name: "gatekeeper.review",
      schema: Answer,
      tier: "fast",
      system: system(ctx, "Gatekeeper, a brand, compliance and quality editor", [], [
        "Score humanFeel strictly. Buyers and platforms punish copy that reads as AI.",
        "Any number, result, customer name or testimonial not present in the client profile or the asset's own evidence is an unsupported claim.",
        "fail = would embarrass the brand or break a rule; fix = good idea, specific problems; pass = ship it.",
      ]),
      prompt: [asJson("rule_findings", ev.ruleFindings), asJson("assets", reviewable.map((a) => ({ id: a.id, kind: a.kind, channel: a.channel, voice: a.voice, title: a.title, body: a.body, tags: a.tags })))].join("\n\n"),
    };
  },

  async finish(ctx, _input, ev, answer) {
    const reviews = answer ? Answer.parse(answer).reviews : [];
    let passed = 0;
    let failed = 0;
    let auto = 0;
    for (const a of ev.queue) {
      const r = reviews.find((x) => x.assetId === a.id);
      const reasons = [...(ev.ruleFindings[a.id] ?? [])];
      if (r) {
        if (r.humanFeel <= 2) reasons.push(`reads as AI (human-feel ${r.humanFeel}/5)`);
        reasons.push(...r.unsupportedClaims.map((c) => `unsupported claim: ${c}`), ...r.policyRisks.map((p) => `policy: ${p}`));
        if (r.verdict !== "pass" && r.fix) reasons.push(`fix: ${r.fix}`);
      }
      const ok = (ev.ruleFindings[a.id] ?? []).length === 0 && (!r || r.verdict === "pass") && (!r || r.humanFeel >= 3);
      const level = a.approval.level;
      const canAuto = ok && (level === "A0" || level === "A1") && !ALWAYS_HUMAN.includes(a.kind) && (a.voice === "brand" || a.voice === "creator");
      await ctx.store.update<Asset>("assets", a.id, {
        gate: { status: ok ? "passed" : "failed", reasons, humanFeel: r?.humanFeel },
        approval: canAuto ? { ...a.approval, status: "auto", at: new Date().toISOString() } : a.approval,
      });
      if (ok) passed++;
      else failed++;
      if (canAuto) auto++;
    }
    return { checked: ev.queue.length, passed, failed, auto };
  },

  summarize: (o) => `${o.checked} checked: ${o.passed} passed (${o.auto} auto-approved), ${o.failed} failed`,
});
