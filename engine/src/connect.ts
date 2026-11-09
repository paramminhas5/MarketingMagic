// mm connect: what this client's machine is plugged into, what's missing, and the one step that fixes each.
// It only reads config, env and saved docs. It never calls an outside service.
import { existsSync, readFileSync } from "node:fs";
import { makeCtx, loadDoc, Strategy, Readiness, writeFile, type Asset } from "@mm/core";

type Item = { area: string; ok: boolean | "info"; what: string; how?: string; owner: "Param" | "developer" | "engine" };

export async function connectReport(slug: string): Promise<{ items: Item[]; md: string; path: string }> {
  const ctx = makeCtx("auditor", slug);
  const { client, machine } = ctx;
  const on = (id: string) => Boolean(machine?.products.find((p) => p.id === id && p.enabled));
  const env = (k: string) => Boolean(process.env[k]);
  const acc = client.accounts;
  const items: Item[] = [];

  // thinking + storage
  items.push(env("ANTHROPIC_API_KEY")
    ? { area: "Model", ok: true, what: "ANTHROPIC_API_KEY is set, so thinking steps run on their own.", owner: "engine" }
    : { area: "Model", ok: "info", what: "No API key. Thinking steps wait as pending files for a Claude session (the daily scheduled task answers them).", how: "Optional: set ANTHROPIC_API_KEY to run unattended without a session.", owner: "Param" });
  items.push(process.env.MM_STORE === "supabase" && env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
    ? { area: "Store", ok: true, what: "Supabase store: every surface sees the same leads, assets and runs.", owner: "engine" }
    : { area: "Store", ok: "info", what: "File store in this repo. Fine for one machine.", how: "To share state across sessions: connect a Supabase project, set MM_STORE=supabase, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and apply supabase/migrations.", owner: "Param" });

  // leads
  const feed = acc.leads_feed;
  items.push(feed || env("MM_LEAD_ENDPOINT")
    ? { area: "Leads", ok: true, what: feed ? `Leads feed: ${feed}. Lead Desk pulls it with the Supabase connector.` : "Lead intake endpoint is set.", owner: "engine" }
    : { area: "Leads", ok: false, what: "No way for leads to reach the engine.", how: "Point accounts.leads_feed at a view of the site's leads (supabase://<project>/<schema.view>), or deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT.", owner: "developer" });
  if (feed) items.push({ area: "Leads", ok: "info", what: "Reading the leads feed needs your OK once: it holds names and emails.", how: "Say \"OK to import leads\" in a session, or keep importing by hand with mm import feed.", owner: "Param" });
  items.push(env("MM_ALERT_WEBHOOK")
    ? { area: "Alerts", ok: true, what: "Hot leads and the daily digest post to your webhook.", owner: "engine" }
    : { area: "Alerts", ok: false, what: "Hot leads and digests have nowhere to go, so a hot lead can sit for hours.", how: "Make a Slack or Discord incoming webhook and set MM_ALERT_WEBHOOK.", owner: "Param" });

  // code + site
  const code = client.audit.codebase;
  items.push(code && existsSync(code)
    ? { area: "Site code", ok: true, what: `Codebase at ${code}. The Auditor reads it and counts only what's on the default branch as live.`, owner: "engine" }
    : { area: "Site code", ok: client.url ? "info" : false, what: code ? `audit.codebase points at ${code}, which isn't here.` : "No codebase. The Auditor only sees the live site.", how: acc.repo ? `Clone ${acc.repo} and set audit.codebase to its path.` : "Add the repo to the session and set audit.codebase.", owner: "developer" });
  if (!client.url) items.push({ area: "Site", ok: false, what: "No site URL in client.yaml.", how: "Add url: https://…", owner: "Param" });

  // paid
  const strategy = loadDoc(ctx, "strategy", Strategy);
  const paidText = (strategy?.channels ?? []).filter((c) => c.budgetShare > 0).map((c) => c.channel).join(" ").toLowerCase();
  if (on("media-buyer")) {
    if (/meta|instagram|facebook|boost/.test(paidText) || !strategy) {
      items.push(acc.meta_ad_account
        ? { area: "Paid", ok: true, what: `Meta ad account ${acc.meta_ad_account}.`, owner: "engine" }
        : { area: "Paid", ok: false, what: "No Meta ad account, so campaigns can't be built (paused) or read.", how: "Add accounts.meta_ad_account: act_<id> (Ads Manager, top left).", owner: "Param" });
      items.push(env("META_ACCESS_TOKEN")
        ? { area: "Paid", ok: true, what: "META_ACCESS_TOKEN set for unattended reads.", owner: "engine" }
        : { area: "Paid", ok: "info", what: "No Meta token: the Meta connector in a Claude session does the work instead.", how: "Optional: a system-user token in META_ACCESS_TOKEN for unattended metric pulls.", owner: "Param" });
    }
    if (/linkedin/.test(paidText)) items.push(acc.linkedin_ad_account ? { area: "Paid", ok: true, what: `LinkedIn ad account ${acc.linkedin_ad_account}.`, owner: "engine" } : { area: "Paid", ok: false, what: "No LinkedIn ad account.", how: "Add accounts.linkedin_ad_account.", owner: "Param" });
    if (/google/.test(paidText)) items.push(acc.google_ad_account ? { area: "Paid", ok: true, what: `Google Ads account ${acc.google_ad_account}.`, owner: "engine" } : { area: "Paid", ok: false, what: "No Google Ads account.", how: "Add accounts.google_ad_account.", owner: "Param" });
  }

  // outbound
  if (on("hunter")) {
    items.push(env("APOLLO_API_KEY") ? { area: "Outbound", ok: true, what: "Apollo key set.", owner: "engine" } : { area: "Outbound", ok: "info", what: "No Apollo key: the Apollo connector in a session finds accounts instead.", owner: "Param" });
    items.push(client.audit.sendingDomains.length
      ? { area: "Outbound", ok: true, what: `Sending domains: ${client.audit.sendingDomains.join(", ")} (SPF and DMARC checked by the Auditor).`, owner: "engine" }
      : { area: "Outbound", ok: false, what: "No sending domain. Cold email from the main domain risks its deliverability.", how: "Buy a lookalike domain, warm it for 2 to 4 weeks, add it to audit.sendingDomains.", owner: "Param" });
  }

  // voices
  if (on("voice")) for (const v of client.voices) {
    const p = ctx.path("voice", `${v.id}.md`);
    const chars = existsSync(p) ? readFileSync(p, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim().length : 0;
    items.push(chars >= 1500 ? { area: "Voice", ok: true, what: `${v.name}: ${chars} characters of real writing.`, owner: "engine" } : { area: "Voice", ok: false, what: `${v.name}: ${chars} characters of samples. Drafts won't sound like them yet.`, how: `Paste 10 to 20 real posts or messages into clients/${slug}/voice/${v.id}.md.`, owner: "Param" });
  }

  // things only a human can confirm, and approvals
  const rp = ctx.path("research", "readiness.json");
  if (existsSync(rp)) {
    const r = Readiness.parse(JSON.parse(readFileSync(rp, "utf8")));
    for (const c of r.checks.filter((c) => c.status === "unknown")) items.push({ area: "Confirm", ok: false, what: `${c.title}: the engine can't see this.`, how: `Check it, then add \`${c.id}: "<what you saw>"\` under audit.attest in client.yaml.`, owner: "Param" });
  } else items.push({ area: "Confirm", ok: false, what: "No readiness audit yet.", how: `mm run auditor --client ${slug}`, owner: "engine" });
  const pending = await ctx.store.list<Asset>("assets", (a) => a.approval.status === "pending");
  if (pending.length) items.push({ area: "Approvals", ok: false, what: `${pending.length} assets waiting for you.`, how: `mm approvals --client ${slug}`, owner: "Param" });

  const mark = (i: Item) => (i.ok === true ? "✓" : i.ok === "info" ? "·" : "✗");
  const todo = items.filter((i) => i.ok === false);
  const md = [
    `# Connections · ${client.name} · ${new Date().toISOString().slice(0, 10)}`,
    `${items.filter((i) => i.ok === true).length} connected · ${todo.length} to do · ${items.filter((i) => i.ok === "info").length} optional`,
    todo.length ? `## To do\n${todo.map((i) => `- [ ] **${i.area}** (${i.owner}): ${i.what}${i.how ? ` ${i.how}` : ""}`).join("\n")}` : "Nothing missing.",
    `## Everything\n| | area | state | how |\n|---|---|---|---|\n${items.map((i) => `| ${mark(i)} | ${i.area} | ${i.what.replace(/\|/g, "/")} | ${(i.ok === true ? "" : i.how ?? "").replace(/\|/g, "/")} |`).join("\n")}`,
  ].join("\n\n");
  const path = ctx.path("out", "connect.md");
  writeFile(path, md);
  return { items, md, path };
}
