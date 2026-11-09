// Architect builds the client's machine: which products run, how often, with
// how much autonomy and inside which caps. This is what makes onboarding a new
// client produce "a similar machine" tuned to that client.
import {
  defineProduct,
  z,
  Machine,
  MachineProduct,
  Strategy,
  PRODUCT_IDS,
  system,
  asJson,
  requireDoc,
  makeAsset,
  writeYaml,
  writeFile,
  type ProductId,
} from "@mm/core";

const Input = z.object({
  monthlyPaid: z.number().optional().describe("Monthly paid media budget in the client's currency"),
  dailyCap: z.number().optional(),
  approvers: z.array(z.string()).optional(),
});

const Answer = z.object({
  products: z.array(MachineProduct),
  commitments: Machine.shape.commitments,
  kpis: z.array(z.object({ name: z.string(), target: z.string() })),
  weeklyRhythm: z.array(z.string()),
  rationale: z.string(),
});

// Non-negotiables from the research and architecture, applied after the model answers.
const LOCKS: Partial<Record<ProductId, { enabled?: boolean; maxAutonomy?: "A0" | "A1" | "A2" | "A3"; minAutonomy?: "A2" | "A3" }>> = {
  intake: { enabled: false },
  auditor: { enabled: true },
  planner: { enabled: true },
  proof: { enabled: true },
  gatekeeper: { enabled: true },
  analyst: { enabled: true },
  "lead-desk": { enabled: true },
  voice: { minAutonomy: "A2" },
  hunter: { minAutonomy: "A2" },
  strategist: { minAutonomy: "A2" },
  architect: { minAutonomy: "A2" },
};
const rank = { A0: 0, A1: 1, A2: 2, A3: 3 } as const;

// Schedules for the always-on core when the model doesn't specify them.
export const CORE_DEFAULTS: Partial<Record<ProductId, Partial<MachineProduct>>> = {
  auditor: { schedule: "5 8 * * 1", autonomy: "A0", notes: "Weekly readiness audit; gates spend and outbound" },
  planner: { schedule: "9 8 1 * *", autonomy: "A0", notes: "Monthly test plan from budget and observed costs" },
  proof: { schedule: "33 8 * * 1", autonomy: "A0", notes: "Weekly commitments vs delivered" },
  analyst: { schedule: "3 8 * * 1", autonomy: "A0" },
  gatekeeper: { schedule: "after every production run", autonomy: "A0" },
  "lead-desk": { schedule: "event", autonomy: "A1" },
};

export default defineProduct({
  manifest: {
    id: "architect",
    name: "Architect",
    job: "Design the client's machine: which products run, on what schedule, with what autonomy and caps.",
    defaultAutonomy: "A2",
    defaultSchedule: "on-demand (onboarding) + monthly",
    reads: ["client.yaml", "research/strategy.json", "product manifests"],
    writes: ["machine.yaml", "out/schedules.md", "assets(kind=machine) for approval"],
    connectors: ["Scheduled tasks (to install the schedules once machine.yaml is approved)"],
    apis: [],
    skill: {
      gather: ["Make sure research/strategy.json exists and is approved."],
      act: [
        "Run `mm run architect --client <slug> --input '{\"monthlyPaid\":60000,\"dailyCap\":3000}'`.",
        "After approval, create one scheduled task per enabled product using the prompts in out/schedules.md.",
      ],
    },
    evidence: ["10-ai-native-marketing-ops", "00-synthesis"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run `mm run strategist` first.");
    return { strategy };
  },

  think(ctx, input, ev) {
    return {
      name: "architect.machine",
      schema: Answer,
      system: system(ctx, "Architect, who designs each client's marketing machine", ["synthesis", "aiOps"], [
        `Products available: ${PRODUCT_IDS.join(", ")}. Return one entry per product (enabled true/false).`,
        "Schedules are 5-field cron in Asia/Kolkata unless the client is elsewhere, or 'event' (runs on webhooks, e.g. lead-desk) or 'on-demand'.",
        "Autonomy: A0 auto, A1 auto within caps, A2 human approves, A3 human only. Start conservative; autonomy is earned later.",
        "Caps are numbers: e.g. media-buyer {dailySpend, budgetShiftPct}, hunter {sendsPerMailboxPerDay, newContactsPerWeek}, studio {conceptsPerWeek}.",
        "Enable only what the strategy's channels need. A creator/media brand without B2B buyers should not run hunter.",
        "auditor, planner, proof, gatekeeper, analyst and lead-desk are always on. intake is on-demand.",
        "Write commitments: the inputs the engine promises each week or month (ad_concepts, voice_drafts, social_posts, pages, sequences, flows, leads_answered_10min_pct, audits, memos), sized to the caps.",
      ]),
      prompt: [
        asJson("strategy", ev.strategy),
        asJson("budget", { monthlyPaid: input.monthlyPaid ?? "unknown", dailyCap: input.dailyCap ?? "unknown" }),
        "Design the machine.",
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, _ev, answer) {
    const a = Answer.parse(answer);
    const byId = new Map(a.products.map((p) => [p.id, p]));
    const products = PRODUCT_IDS.map((id) => {
      const p: MachineProduct = byId.get(id) ?? { id, enabled: false, schedule: "on-demand", autonomy: "A2", caps: {}, notes: "" };
      const lock = LOCKS[id];
      const d = CORE_DEFAULTS[id];
      if (d && !byId.has(id)) Object.assign(p, d);
      if (lock?.enabled !== undefined) p.enabled = lock.enabled;
      if (lock?.minAutonomy && rank[p.autonomy] < rank[lock.minAutonomy]) p.autonomy = lock.minAutonomy;
      return p;
    });
    const dailyCap = input.dailyCap ?? 0;
    const mb = products.find((p) => p.id === "media-buyer");
    if (mb && dailyCap) mb.caps = { ...mb.caps, dailySpend: Math.min(mb.caps.dailySpend ?? dailyCap, dailyCap) };

    const machine = Machine.parse({
      client: ctx.client.slug,
      timezone: "Asia/Kolkata",
      products,
      budgets: { currency: ctx.client.currency, monthlyPaid: input.monthlyPaid ?? 0, dailyCap },
      approvers: input.approvers ?? ctx.client.voices.slice(0, 1).map((v) => v.id),
      kpis: a.kpis,
      weeklyRhythm: a.weeklyRhythm,
      commitments: a.commitments ?? [],
    });
    writeYaml(ctx.path("machine.yaml"), machine);

    const schedules = machine.products
      .filter((p) => p.enabled && /^[\d*]/.test(p.schedule))
      .map(
        (p) =>
          `## ${p.id} · \`${p.schedule}\` (${machine.timezone})\n\nPrompt for the scheduled task:\n\n> In the MarketingMagic repo, run the ${p.id} product for client ${ctx.client.slug}: follow products/${p.id}/SKILL.md, run \`mm run ${p.id} --client ${ctx.client.slug}\`, complete any pending thinking step, and email a 5-line summary of what changed and what needs approval.`,
      )
      .join("\n\n");
    writeFile(ctx.path("out", "schedules.md"), `# Scheduled tasks for ${ctx.client.name}\n\n${a.rationale}\n\n${schedules}\n`);
    await ctx.store.insert(
      "assets",
      makeAsset(ctx, "architect", { kind: "machine", channel: "internal", title: `Machine for ${ctx.client.name}`, body: a.rationale }),
    );
    return machine;
  },

  summarize: (m) => `machine: ${m.products.filter((p) => p.enabled).map((p) => p.id).join(", ")}`,
});
