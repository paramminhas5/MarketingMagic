// mm: the Marketing Magic command line.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  activeClient,
  clientDir,
  listClients,
  setActiveClient,
  scaffoldClient,
  loadClient,
  loadMachine,
  openStore,
  pendingFiles,
  submitPending,
  similarity,
  newId,
  Asset,
  Lead,
  MetricRow,
  Playbook,
  type ProductId,
  type RunLog,
} from "@mm/core";
import { PRODUCTS, product } from "./registry.ts";
import { onboard, campaign, cycle, loadBrief, runOne, type StepReport } from "./conductor.ts";
import { generateSkills } from "./skills.ts";
import { tick, autopilotPrompt } from "./autopilot.ts";
import { repoRoot, readinessGate, makeCtx } from "@mm/core";

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const flags: Record<string, string> = {};
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    flags[k] = v;
  } else pos.push(a);
}
const [cmd, ...args] = pos;
const num = (k: string) => (flags[k] ? Number(flags[k]) : undefined);

function parseInput(v?: string): unknown {
  if (!v) return {};
  if (v.startsWith("@")) return JSON.parse(readFileSync(v.slice(1), "utf8"));
  return JSON.parse(v);
}

function printReports(rs: StepReport[]) {
  for (const r of rs) {
    const res = r.result;
    if (res.status === "done") console.log(`  ✓ ${r.product}: ${res.summary}`);
    else if (res.status === "pending") console.log(`  … ${r.product}: thinking step saved → ${res.pendingFile}`);
    else console.log(`  - ${r.product}: ${res.reason}`);
  }
  const pend = rs.find((r) => r.result.status === "pending");
  if (pend) console.log(`\nAnswer the pending file in a Claude session, then: mm submit <pending.json> <answer.json>`);
}

// ---------------------------------------------------------------- commands

const HELP = `mm · Marketing Magic

Clients
  mm clients                               list clients (* = active)
  mm use <slug>                            switch active client
  mm new <slug> --url https://x            Intake fills the profile from the site on onboard
  mm new <slug> --name "X" --url https://x --playbook consumer|b2b_service|creator_media
  mm status [--client slug]                docs, machine, assets, approvals, leads, pending steps

Pipelines (the Conductor)
  mm onboard [--client slug] [--objective "..."] [--monthly 60000] [--daily 3000]
                                           intake -> scout -> strategist -> architect -> auditor -> planner (resumable)
  mm campaign <brief.yaml> [--client slug] production products in machine.yaml -> gatekeeper
  mm cycle [--client slug] [--target 250]  lead-desk -> gatekeeper -> analyst

Autopilot
  mm tick [--all | --client slug] [--dry]  run every product that's due per machine.yaml
  mm autopilot                             the one scheduled-task prompt that runs everything
  mm readiness [--client slug]             is spend / outbound unlocked, and why not

Products (each works alone)
  mm products                              list products and their jobs
  mm run <product> [--client slug] [--input '<json>' | --input @file.json]
  mm pending [--client slug]               thinking steps waiting for a Claude session
  mm submit <pending.json> <answer.json>   finish a pending step

Approvals
  mm approvals [--client slug] [--all]     what needs a human
  mm approve <assetId> [--final file.txt] [--note "..."]
  mm reject <assetId> --note "why"

Data
  mm import metrics <file.json>            rows: date, channel, entityId, entityName, spend, impressions, clicks, results, revenue, frequency, assetId?
  mm import lead <file.json>               one lead or an array
  mm import feed <file.json>               rows from a site's marketing.leads_feed (deduped by id)
  mm skills                                regenerate SKILL.md/README.md for every product
`;

async function main() {
  switch (cmd) {
    case undefined:
    case "help":
      console.log(HELP);
      return;

    case "clients": {
      let active = "";
      try {
        active = activeClient();
      } catch {}
      for (const c of listClients()) {
        const p = loadClient(c);
        console.log(`${c === active ? "*" : " "} ${c.padEnd(18)} ${p.playbook.padEnd(14)} ${p.name}`);
      }
      return;
    }

    case "use":
      setActiveClient(args[0]);
      console.log(`Active client: ${args[0]}`);
      return;

    case "new": {
      const slug = args[0];
      if (!slug || (!flags.url && !flags.name)) throw new Error("mm new <slug> --url https://site  (or --name ... --playbook ...)");
      const draft = !flags.name || !flags.playbook;
      if (flags.playbook) Playbook.parse(flags.playbook);
      const name = flags.name ?? new URL(flags.url).hostname.replace(/^www\./, "").split(".")[0];
      const dir = scaffoldClient(slug, { name, url: flags.url, playbook: flags.playbook ?? "consumer", description: flags.description, draft });
      setActiveClient(slug);
      console.log(
        draft
          ? `Created ${dir} (draft) and made it active.\nNext: mm onboard --monthly <budget> --daily <cap>\nIntake reads the site and fills client.yaml first.`
          : `Created ${dir} and made it active.\nNext: fill in client.yaml, then: mm onboard --monthly <budget> --daily <cap>`,
      );
      return;
    }

    case "tick": {
      const clients = flags.all === "true" ? undefined : [activeClient(flags.client)];
      const items = await tick({ clients, dryRun: flags.dry === "true" });
      if (!items.length) return console.log("Nothing due.");
      for (const it of items) {
        const r = it.report?.result;
        const detail = r ? (r.status === "done" ? r.summary : r.status === "pending" ? `thinking step → ${r.pendingFile}` : r.reason) : it.reason;
        console.log(`${it.action === "run" ? (r?.status === "pending" ? "…" : "✓") : "-"} ${it.client}/${it.product}: ${detail}`);
      }
      return;
    }

    case "autopilot": {
      console.log(`Create ONE scheduled task (daily, e.g. 08:41 Asia/Kolkata) with this prompt:\n\n${autopilotPrompt(repoRoot())}\n\nThe tick reads every client's machine.yaml, so adding a client needs no new task.`);
      return;
    }

    case "readiness": {
      const slug = activeClient(flags.client);
      for (const g of ["spend", "outbound"] as const) {
        const r = readinessGate(makeCtx("auditor", slug), g);
        console.log(`${g}: ${r.open ? "unlocked" : "LOCKED"}${r.score !== undefined ? ` (score ${r.score}/100)` : ""}`);
        for (const reason of r.reasons) console.log(`  - ${reason}`);
      }
      console.log(`Details: clients/${slug}/research/readiness.md · plan: clients/${slug}/out/opening-playbook.md`);
      return;
    }

    case "products":
      for (const p of Object.values(PRODUCTS)) console.log(`${p.manifest.id.padEnd(13)} ${p.manifest.defaultAutonomy}  ${p.manifest.job}`);
      return;

    case "run": {
      const id = args[0] as ProductId;
      const slug = activeClient(flags.client);
      const r = await runOne(id, slug, parseInput(flags.input));
      printReports([r]);
      return;
    }

    case "onboard": {
      const slug = activeClient(flags.client ?? args[0]);
      console.log(`Onboarding ${slug}`);
      printReports(
        await onboard(slug, {
          objective: flags.objective,
          offer: flags.offer,
          focus: flags.focus,
          monthlyPaid: num("monthly"),
          dailyCap: num("daily"),
          approvers: flags.approvers?.split(","),
        }),
      );
      if (loadMachine(slug)) {
        console.log(`\nMachine ready: clients/${slug}/machine.yaml · schedules: clients/${slug}/out/schedules.md · approve with: mm approvals`);
      }
      return;
    }

    case "campaign": {
      const slug = activeClient(flags.client);
      const brief = loadBrief(args[0]);
      console.log(`Campaign "${brief.campaign}" for ${slug}`);
      printReports(await campaign(slug, brief));
      return;
    }

    case "cycle": {
      const slug = activeClient(flags.client);
      printReports(await cycle(slug, num("target")));
      return;
    }

    case "pending": {
      const slug = activeClient(flags.client);
      const files = pendingFiles(slug);
      console.log(files.length ? files.join("\n") : "Nothing pending.");
      return;
    }

    case "submit": {
      const [pendingFile, answerFile] = args;
      if (!pendingFile || !answerFile) throw new Error("mm submit <pending.json> <answer.json>");
      const answer = JSON.parse(readFileSync(answerFile, "utf8"));
      const r = await submitPending((id) => product(id), resolve(pendingFile), answer);
      console.log(`✓ ${r.client}/${r.product}: ${r.summary}`);
      return;
    }

    case "approvals": {
      const slug = activeClient(flags.client);
      const store = openStore(slug);
      const rows = await store.list<Asset>("assets", (a) => flags.all === "true" || a.approval.status === "pending");
      if (!rows.length) return console.log("Nothing waiting.");
      for (const a of rows) {
        const gate = a.gate.status === "failed" ? `✗ gate: ${a.gate.reasons.join("; ")}` : a.gate.status === "passed" ? "✓ gate" : "· not gated yet";
        console.log(`${a.id.padEnd(22)} ${a.approval.level} ${a.kind.padEnd(14)} ${a.channel.padEnd(10)} ${a.voice.padEnd(8)} ${a.title.slice(0, 60)}\n${" ".repeat(23)}${gate}`);
      }
      return;
    }

    case "approve":
    case "reject": {
      const slug = activeClient(flags.client);
      const store = openStore(slug);
      const a = await store.get<Asset>("assets", args[0]);
      if (!a) throw new Error(`No asset ${args[0]}`);
      const final = flags.final ? readFileSync(flags.final, "utf8") : undefined;
      const editDistance = final ? 1 - similarity(a.body, final) : 0;
      await store.update<Asset>("assets", a.id, {
        ...(final ? { body: final, aiLevel: "hybrid" as const } : {}),
        approval: { ...a.approval, status: cmd === "approve" ? "approved" : "rejected", by: flags.by ?? "human", at: new Date().toISOString(), editDistance, note: flags.note },
      });
      console.log(`${cmd === "approve" ? "Approved" : "Rejected"} ${a.id}${final ? ` (edit distance ${editDistance.toFixed(2)})` : ""}`);
      return;
    }

    case "import": {
      const slug = activeClient(flags.client);
      const store = openStore(slug);
      const data = JSON.parse(readFileSync(args[1], "utf8"));
      const rows = Array.isArray(data) ? data : [data];
      if (args[0] === "metrics") {
        const parsed = rows.map((r) => MetricRow.parse({ id: newId("m"), client: slug, ...r }));
        await store.insertMany("metrics", parsed);
        console.log(`Imported ${parsed.length} metric rows`);
      } else if (args[0] === "lead") {
        const parsed = rows.map((r) => Lead.parse({ id: newId("lead"), client: slug, createdAt: new Date().toISOString(), ...r }));
        await store.insertMany("leads", parsed);
        console.log(`Imported ${parsed.length} leads`);
      } else if (args[0] === "feed") {
        // Rows shaped like a site's marketing.leads_feed: one per conversion, with how they heard.
        const existing = new Set((await store.list<Lead>("leads")).map((l) => l.id));
        const weekAgo = Date.now() - 7 * 864e5;
        const parsed = rows
          .filter((r) => r.id && r.email && !existing.has(String(r.id)))
          .map((r) => {
            const src = String(r.source ?? "form");
            const converted = /^ticket_(paid|free)$|^rsvp$/.test(src);
            const old = Date.parse(r.created_at) < weekAgo;
            return Lead.parse({
              id: String(r.id),
              client: slug,
              source: src,
              name: r.name ?? undefined,
              email: r.email,
              phone: r.phone ?? r.whatsapp ?? undefined,
              message: r.message ?? undefined,
              utm: Object.fromEntries(Object.entries({ ...(r.utm ?? {}), ref: r.ref ?? "" }).filter(([, v]) => v).map(([k, v]) => [k, String(v)])),
              hdyhauRaw: r.heard_from ?? undefined,
              status: converted ? "won" : src.startsWith("signup") || old ? "contacted" : "new",
              createdAt: new Date(r.created_at).toISOString(),
            });
          });
        await store.insertMany("leads", parsed);
        console.log(`Imported ${parsed.length} new conversions (${rows.length - parsed.length} already in the store or unusable)`);
      } else throw new Error("mm import metrics|lead|feed <file.json>");
      return;
    }

    case "status": {
      const slug = activeClient(flags.client ?? args[0]);
      const c = loadClient(slug);
      const m = loadMachine(slug);
      const store = openStore(slug);
      const assets = await store.list<Asset>("assets");
      const leads = await store.list<Lead>("leads");
      const runs = await store.list<RunLog>("runs");
      const has = (f: string) => (existsSync(clientDir(slug, f)) ? "✓" : "·");
      console.log(`${c.name} (${slug}) · ${c.playbook}`);
      console.log(`  research: ${has("research/market-brief.json")} market brief  ${has("research/strategy.json")} strategy  ${has("machine.yaml")} machine`);
      if (m) console.log(`  machine: ${m.products.filter((p) => p.enabled).map((p) => `${p.id}(${p.autonomy})`).join(" ")}`);
      const by = (k: string) => assets.filter((a) => a.approval.status === k).length;
      console.log(`  assets: ${assets.length} · pending approval ${by("pending")} · approved ${by("approved")} · auto ${by("auto")} · rejected ${by("rejected")}`);
      console.log(`  leads: ${leads.length} · hot ${leads.filter((l) => l.route === "hot").length}`);
      console.log(`  runs: ${runs.length} · tokens ${runs.reduce((a, r) => a + r.inputTokens + r.outputTokens, 0)}`);
      console.log(`  pending thinking steps: ${pendingFiles(slug).length}`);
      // earned autonomy: approvals with no material edits, per product/kind
      const streaks = new Map<string, number>();
      for (const a of assets.filter((x) => x.approval.status === "approved").sort((x, y) => (x.approval.at ?? "").localeCompare(y.approval.at ?? ""))) {
        const k = `${a.product}/${a.kind}`;
        streaks.set(k, (a.approval.editDistance ?? 0) < 0.1 ? (streaks.get(k) ?? 0) + 1 : 0);
      }
      const ready = [...streaks].filter(([, n]) => n >= 20);
      if (ready.length) console.log(`  ready to earn A1 (20+ clean approvals): ${ready.map(([k]) => k).join(", ")}`);
      return;
    }

    case "skills": {
      const ids = generateSkills();
      console.log(`Wrote SKILL.md + README.md for ${ids.length} products and .claude/skills/mm-*`);
      return;
    }

    default:
      console.log(`Unknown command "${cmd}".\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
});
