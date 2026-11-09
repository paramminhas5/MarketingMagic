// Evidence for the audit comes from up to four places, in this order of trust:
//   1. the live site (raw HTML, robots.txt, sitemap.xml, llms.txt)
//   2. pages a Claude session saved into clients/<slug>/inputs/auditor/ (WebFetch/browser)
//   3. the site's source code, if client.audit.codebase points at it
//   4. the engine's own state (machine, strategy, assets, leads, env)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { tools, readInputs, type Ctx, type Asset, type Lead } from "@mm/core";

export interface WebEvidence {
  pages: tools.RawPage[];
  robots?: tools.RawPage;
  sitemap?: tools.RawPage;
  llms?: tools.RawPage;
  saved: Record<string, string>;
  /** All reachable HTML + saved text joined, for pattern checks */
  text: string;
  reachable: boolean;
}

export interface CodeEvidence {
  root?: string;
  files: number;
  /** path -> content (truncated) */
  corpus: Map<string, string>;
  paths: string[];
}

export interface EngineEvidence {
  assets: Asset[];
  leads: Lead[];
  env: { leadEndpoint: boolean; alertWebhook: boolean; apiKey: boolean };
  voiceCorpusChars: Record<string, number>;
}

export interface DnsEvidence {
  domains: Record<string, { spf?: string; dmarc?: string; reachable: boolean }>;
}

export interface Evidence {
  web: WebEvidence;
  code: CodeEvidence;
  engine: EngineEvidence;
  dns: DnsEvidence;
  sources: string[];
}

const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".html", ".json", ".txt", ".toml", ".sql", ".md", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel", ".turbo", "coverage", ".migration-backup", ".cache"]);

function walk(root: string, maxFiles = 4000, maxBytes = 25_000_000): CodeEvidence {
  const corpus = new Map<string, string>();
  const paths: string[] = [];
  let bytes = 0;
  const stack = [root];
  while (stack.length && paths.length < maxFiles && bytes < maxBytes) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e) || e.startsWith(".env")) continue;
      const p = join(dir, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) stack.push(p);
      else if (CODE_EXT.has(extname(e)) || ["robots.txt", "llms.txt"].includes(e)) {
        const rel = relative(root, p);
        paths.push(rel);
        if (st.size < 400_000) {
          const content = readFileSync(p, "utf8");
          corpus.set(rel, content);
          bytes += content.length;
        }
      }
    }
  }
  return { root, files: paths.length, corpus, paths };
}

async function web(ctx: Ctx): Promise<WebEvidence> {
  const base = ctx.client.url?.replace(/\/$/, "");
  const saved = readInputs(ctx.client.slug, "auditor", 60_000);
  if (!base) return { pages: [], saved, text: Object.values(saved).join("\n"), reachable: false };
  const urls = [base, ...ctx.client.audit.pages.map((p) => (p.startsWith("http") ? p : `${base}/${p.replace(/^\//, "")}`))];
  const pages = await Promise.all(urls.map((u) => tools.fetchRaw(u)));
  const [robots, sitemap, llms] = await Promise.all([`${base}/robots.txt`, `${base}/sitemap.xml`, `${base}/llms.txt`].map((u) => tools.fetchRaw(u, 10000)));
  const reachable = pages.some((p) => p.ok);
  const text = [...pages.filter((p) => p.ok).map((p) => p.html), ...Object.values(saved)].join("\n");
  return { pages, robots, sitemap, llms, saved, text, reachable };
}

async function dns(ctx: Ctx): Promise<DnsEvidence> {
  const domains: DnsEvidence["domains"] = {};
  for (const d of ctx.client.audit.sendingDomains) {
    const [spfRecs, dmarcRecs] = await Promise.all([tools.txt(d), tools.txt(`_dmarc.${d}`)]);
    domains[d] = {
      reachable: spfRecs !== undefined,
      spf: spfRecs?.find((r) => r.startsWith("v=spf1")),
      dmarc: dmarcRecs?.find((r) => r.toLowerCase().startsWith("v=dmarc1")),
    };
  }
  return { domains };
}

export async function gatherEvidence(ctx: Ctx, opts: { offline?: boolean } = {}): Promise<Evidence> {
  const w = opts.offline
    ? { pages: [], saved: readInputs(ctx.client.slug, "auditor", 60_000), text: Object.values(readInputs(ctx.client.slug, "auditor", 60_000)).join("\n"), reachable: false }
    : await web(ctx);
  const root = ctx.client.audit.codebase;
  const code = root && existsSync(root) ? walk(root) : { files: 0, corpus: new Map<string, string>(), paths: [] };
  const assets = await ctx.store.list<Asset>("assets");
  const leads = await ctx.store.list<Lead>("leads");
  const voiceCorpusChars: Record<string, number> = {};
  for (const v of ctx.client.voices) {
    const p = ctx.path("voice", `${v.id}.md`);
    voiceCorpusChars[v.id] = existsSync(p) ? readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim().length : 0;
  }
  const sources = [
    ...w.pages.filter((p) => p.ok).map((p) => `live: ${p.url}`),
    ...Object.keys(w.saved).map((f) => `saved: inputs/auditor/${f}`),
    ...(code.files ? [`codebase: ${root} (${code.files} files)`] : []),
    "engine state",
  ];
  return {
    web: w,
    code,
    engine: {
      assets,
      leads,
      env: { leadEndpoint: Boolean(process.env.MM_LEAD_ENDPOINT), alertWebhook: Boolean(process.env.MM_ALERT_WEBHOOK), apiKey: Boolean(process.env.ANTHROPIC_API_KEY) },
      voiceCorpusChars,
    },
    dns: opts.offline ? { domains: {} } : await dns(ctx),
    sources,
  };
}

/** Find a pattern in web text and code; returns where it was seen. */
export function seen(ev: Evidence, re: RegExp, opts: { web?: boolean; code?: boolean; codePathFilter?: RegExp } = {}): string[] {
  const hits: string[] = [];
  if (opts.web !== false && re.test(ev.web.text)) hits.push("site");
  if (opts.code !== false) {
    for (const [path, content] of ev.code.corpus) {
      if (opts.codePathFilter && !opts.codePathFilter.test(path)) continue;
      if (re.test(content)) {
        hits.push(path);
        if (hits.length > 6) break;
      }
    }
  }
  return hits;
}

export function codeHasFile(ev: Evidence, re: RegExp): string | undefined {
  return ev.code.paths.find((p) => re.test(p));
}
