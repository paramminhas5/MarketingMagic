// What each open pull request is worth: score the client's site as if that branch were merged and deployed,
// then all of them together. Turns "merge your PRs" into "merge #27 for +18, #34 for +9".
// Reads git only (fetch, worktrees in a temp folder). Never merges, pushes or changes the client's repo.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, type CheckResult, type Ctx } from "@mm/core";
import { gatherEvidence, walk, type Evidence } from "./evidence.ts";
import { runChecks, score, loopsScore, gateOpen } from "./checks.ts";

export type Scenario = { label: string; ref: string; pr?: number; url?: string; readiness: number; loops?: number; spend: boolean; flips: { id: string; title: string; from: string; to: string }[]; error?: string; checks?: CheckResult[] };

const git = (root: string, ...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function openPrs(ctx: Ctx, root: string): { number?: number; title: string; head: string; url?: string }[] {
  const repo = ctx.client.accounts.repo?.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  if (repo) {
    try {
      const out = execFileSync("gh", ["api", `repos/${repo}/pulls?state=open&per_page=50`, "--jq", ".[] | [.number, .head.ref, .html_url, .title] | @tsv"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return out.split("\n").filter(Boolean).map((l) => { const [n, head, url, ...t] = l.split("\t"); return { number: Number(n), head, url, title: t.join(" ") }; });
    } catch {}
  }
  // No GitHub access: every remote branch with commits the default branch doesn't have.
  const base = defaultRef(root);
  return git(root, "for-each-ref", "--format=%(refname:short)", "refs/remotes/origin").split("\n")
    .filter((b) => b && b !== base && b !== "origin/HEAD" && b !== "origin")
    .filter((b) => Number(git(root, "rev-list", "--count", `${base}..${b}`)) > 0)
    .map((b) => ({ head: b.replace(/^origin\//, ""), title: b.replace(/^origin\//, "") }));
}

function defaultRef(root: string) {
  try { return git(root, "symbolic-ref", "--short", "refs/remotes/origin/HEAD"); } catch { return "origin/main"; }
}

const summary = (checks: CheckResult[]) => ({ readiness: score(checks), loops: loopsScore(checks), spend: gateOpen(checks, "spend").open });

export async function whatIf(ctx: Ctx, opts: { offline?: boolean; only?: number[] } = {}): Promise<{ base: Scenario; prs: Scenario[]; all?: Scenario; md: string; path: string }> {
  const root = ctx.client.audit.codebase;
  if (!root || !existsSync(join(root, ".git"))) throw new Error("audit.codebase must point at a git checkout of the site to project pull requests.");
  try { git(root, "fetch", "-q", "origin", "+refs/heads/*:refs/remotes/origin/*"); } catch {}
  const base = defaultRef(root);
  const ev0 = await gatherEvidence(ctx, { offline: opts.offline });
  const tmp = mkdtempSync(join(tmpdir(), "mm-whatif-"));
  const at = (ref: string, name: string) => { const dir = join(tmp, name); git(root, "worktree", "add", "-q", "--detach", dir, ref); return dir; };
  const evalDir = (dir: string): CheckResult[] => runChecks(ctx, { ...ev0, code: walk(dir, 4000, 25_000_000, true) } as Evidence);
  const flips = (from: CheckResult[], to: CheckResult[]) =>
    to.filter((c) => { const b = from.find((x) => x.id === c.id); return b && b.status !== c.status; })
      .map((c) => ({ id: c.id, title: c.title, from: from.find((x) => x.id === c.id)!.status, to: c.status }));

  try {
    const baseChecks = evalDir(at(base, "base"));
    const baseS: Scenario = { label: `Live (${base.replace(/^origin\//, "")})`, ref: base, ...summary(baseChecks), flips: [] };
    let prs = openPrs(ctx, root);
    if (opts.only?.length) prs = prs.filter((p) => p.number && opts.only!.includes(p.number));
    const out: Scenario[] = [];
    for (const [i, p] of prs.entries()) {
      try {
        const checks = evalDir(at(`origin/${p.head}`, `pr${i}`));
        out.push({ label: p.title, ref: p.head, pr: p.number, url: p.url, ...summary(checks), flips: flips(baseChecks, checks), checks });
      } catch (e) { out.push({ label: p.title, ref: p.head, pr: p.number, url: p.url, readiness: baseS.readiness, spend: baseS.spend, flips: [], error: String(e).slice(0, 160) }); }
    }
    // All the PRs that move a score, merged together in a scratch worktree (conflicting ones are skipped and named).
    let all: Scenario | undefined;
    const movers = out.filter((s) => !s.error && s.flips.length);
    if (movers.length > 1) {
      const dir = at(base, "all");
      const skipped: string[] = [];
      for (const s of movers) {
        try { git(dir, "-c", "user.email=mm@local", "-c", "user.name=mm", "merge", "-q", "--no-edit", `origin/${s.ref}`); }
        catch { try { git(dir, "merge", "--abort"); } catch {} skipped.push(s.pr ? `#${s.pr}` : s.ref); }
      }
      const checks = evalDir(dir);
      all = { label: `All of them together${skipped.length ? ` (skipped, conflicts: ${skipped.join(", ")})` : ""}`, ref: "all", ...summary(checks), flips: flips(baseChecks, checks), checks };
    }

    const delta = (n: number | undefined, b: number | undefined) => (n === undefined || b === undefined ? "" : n === b ? "±0" : `${n > b ? "+" : ""}${n - b}`);
    const row = (s: Scenario) => `| ${s.pr ? (s.url ? `[#${s.pr}](${s.url})` : `#${s.pr}`) : ""} ${s.label.replace(/\|/g, "/")} | ${s.readiness} (${delta(s.readiness, baseS.readiness)}) | ${s.loops ?? "-"} (${delta(s.loops, baseS.loops)}) | ${s.spend ? "unlocked" : "locked"} | ${s.error ? `error: ${s.error}` : s.flips.filter((f) => f.to === "pass" || f.to === "warn").map((f) => `${f.title} → ${f.to}`).join("; ") || "no change"} |`;
    // Path to 100: merge what moves the score, then every remaining check in order of what it's worth.
    const movers2 = out.filter((s) => !s.error && s.flips.some((f) => f.to === "pass" || f.to === "warn"));
    const after = all ?? movers2.sort((a, b) => b.readiness - a.readiness)[0] ?? { ...baseS, checks: baseChecks };
    const afterChecks = after.checks ?? baseChecks;
    const W = { blocker: 3, major: 2, minor: 1 } as const;
    const ownerOrder = { engine: 0, developer: 1, human: 2 } as Record<string, number>;
    const open = afterChecks.filter((c) => c.status !== "pass" && c.status !== "na")
      .sort((a, b) => (a.category === "loops" ? 1 : 0) - (b.category === "loops" ? 1 : 0) || W[b.severity] - W[a.severity] || (ownerOrder[a.owner] ?? 3) - (ownerOrder[b.owner] ?? 3));
    let cur = afterChecks.map((c) => ({ ...c }));
    const steps = open.map((c) => {
      cur = cur.map((x) => (x.id === c.id ? { ...x, status: "pass" as const } : x));
      return { c, readiness: score(cur), loops: loopsScore(cur) };
    });
    const pathMd = [
      "## Path to 100",
      movers2.length
        ? `1. **Merge ${movers2.map((s) => (s.pr ? `#${s.pr}` : s.ref)).join(", ")}** (apply each PR's migration first, as its description says). Readiness ${baseS.readiness} → ${after.readiness}, loops ${baseS.loops ?? "-"} → ${after.loops ?? "-"}.`
        : `1. Nothing open on GitHub moves the score. Readiness ${baseS.readiness}, loops ${baseS.loops ?? "-"}.`,
      ...steps.map((st, i) => `${i + 2}. **${st.c.title}** (${st.c.owner}${st.c.gates.length ? `, unlocks ${st.c.gates.join(" and ")}` : ""}): ${st.c.fix} → readiness ${st.readiness}${st.c.category === "loops" ? `, loops ${st.loops}` : ""}`),
      "",
      "Fixes that change what the live site shows (copy, placeholders) only count once deployed, so they can show here after the merge step.",
    ].join("\n");

    const md = [
      `# What each open PR is worth · ${ctx.client.name} · ${new Date().toISOString().slice(0, 10)}`,
      "Each row scores the site as if that branch were merged and deployed. Checks that also need a setting (pixel id, migration, approval) still count as not done until it's set.",
      "| PR | readiness | loops | paid | what it fixes |\n|---|---|---|---|---|",
      row(baseS),
      ...out.sort((a, b) => b.readiness - a.readiness || (b.loops ?? 0) - (a.loops ?? 0)).map(row),
      ...(all ? [row(all)] : []),
      "",
      pathMd,
    ].join("\n");
    const path = ctx.path("out", "whatif.md");
    writeFile(path, md);
    return { base: baseS, prs: out, all, md, path };
  } finally {
    try { git(root, "worktree", "remove", "--force", join(tmp, "base")); } catch {}
    for (const d of ["all", ...Array.from({ length: 60 }, (_, i) => `pr${i}`)]) { if (existsSync(join(tmp, d))) { try { git(root, "worktree", "remove", "--force", join(tmp, d)); } catch {} } }
    try { git(root, "worktree", "prune"); } catch {}
    rmSync(tmp, { recursive: true, force: true });
  }
}
