// The readiness checks. Each one is a known, evidence-backed leak: if it fails,
// money spent on traffic leaks out of the funnel. They are deterministic on
// purpose: the same funnel always gets the same verdict.
import { median, loadDoc, Strategy, type Asset, type CheckResult, type Ctx } from "@mm/core";
import { seen, codeHasFile, type Evidence } from "./evidence.ts";

type Check = Omit<CheckResult, "gates"> & { gates?: CheckResult["gates"] };

const flowApproved = (assets: Asset[], re: RegExp) => {
  const flows = assets.filter((a) => a.kind === "flow" && re.test(`${a.title} ${String(a.meta.trigger ?? "")}`));
  return {
    any: flows.length > 0,
    approved: flows.some((f) => f.approval.status === "approved" || f.approval.status === "auto"),
  };
};

const PROMISE_RE = /(coming soon|launching soon|available soon|stay tuned|poster coming|placeholder ·)/i;
const PROMISE_CRITICAL = /(redeem|redemption|points|reward|refund|ticket|payment|checkout|book)/i;

export function runChecks(ctx: Ctx, ev: Evidence): CheckResult[] {
  const m = ctx.machine;
  const on = (id: string) => Boolean(m?.products.find((p) => p.id === id && p.enabled));
  const paid = on("media-buyer");
  const outbound = on("hunter");
  const india = ctx.client.geo.some((g) => /india|bengaluru|bangalore|mumbai|delhi|goa|chennai|hyderabad|pune/i.test(g)) || ctx.client.currency === "INR";
  const haveWebOrCode = ev.web.reachable || Object.keys(ev.web.saved).length > 0 || ev.code.files > 0;
  const where = (hits: string[]) => (hits.length ? `Seen in: ${hits.slice(0, 4).join(", ")}${hits.length > 4 ? "…" : ""}` : "");
  const unknownOr = (hits: string[], missing: string) => (hits.length ? "pass" : haveWebOrCode ? "fail" : "unknown") as CheckResult["status"];
  const checks: Check[] = [];

  // ------------------------------------------------------------ tracking
  // Which ad platforms the strategy actually pays for decides which tags are blockers.
  const strategy = loadDoc(ctx, "strategy", Strategy);
  const paidText = (strategy?.channels ?? []).filter((c) => c.budgetShare > 0).map((c) => c.channel).join(" ").toLowerCase();
  const platforms = {
    meta: /meta|instagram|facebook|boost/.test(paidText) || (!strategy && paid),
    linkedin: /linkedin/.test(paidText),
    google: /google/.test(paidText),
  };
  const TAGS = {
    meta: { re: /fbq\(\s*['"](init|track)|connect\.facebook\.net\/[^"']*fbevents|META_PIXEL_ID|NEXT_PUBLIC_(META|FB)_PIXEL/i, title: "Meta pixel sends conversion events", fix: "Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md.", fixWith: "out/fixes/meta-pixel.md" },
    linkedin: { re: /snap\.licdn\.com|_linkedin_partner_id|linkedin[\s_-]?insight/i, title: "LinkedIn Insight Tag with a conversion", fix: "Add the LinkedIn Insight Tag site-wide and a conversion for the form submit in Campaign Manager.", fixWith: undefined },
    google: { re: /gtag\(\s*['"]config['"],\s*['"]AW-|googleadservices|conversion_id/i, title: "Google Ads conversion tag", fix: "Add the Google Ads tag and a conversion action for the primary form or purchase.", fixWith: undefined },
  } as const;
  for (const k of ["meta", "linkedin", "google"] as const) {
    const needed = paid && platforms[k];
    if (!needed && k !== "meta") continue;
    const hits = seen(ev, TAGS[k].re);
    // Code that only switches on with an env var isn't live until someone sets it.
    const envGate = /NEXT_PUBLIC_[A-Z_]*(PIXEL|INSIGHT|GTAG|ADS)[A-Z_]*/.exec([...ev.code.corpus.values()].find((c) => TAGS[k].re.test(c)) ?? "")?.[0];
    const onlyInCode = hits.length > 0 && !hits.includes("site");
    const status = onlyInCode && envGate ? "unknown" : unknownOr(hits, "");
    checks.push({
      id: `tracking.${k === "meta" ? "meta_pixel" : `${k}_tag`}`,
      category: "tracking",
      title: TAGS[k].title,
      severity: needed ? "blocker" : "minor",
      status,
      evidence:
        onlyInCode && envGate
          ? `In the code (${hits.slice(0, 2).join(", ")}) but switched on by ${envGate}. Set it in the host's env, deploy, then attest \`tracking.${k === "meta" ? "meta_pixel" : `${k}_tag`}\` once it shows in the platform's event tester.`
          : where(hits) || (haveWebOrCode ? `No ${TAGS[k].title.split(" ").slice(0, 2).join(" ")} code found on the site or in the codebase.` : "No site or code evidence available."),
      why: "Ad platforms optimise on the conversion events you send; broad targeting with diverse creative only works when the platform can see results (03-paid-acquisition).",
      fix: TAGS[k].fix,
      owner: "developer",
      fixWith: TAGS[k].fixWith,
      gates: needed ? ["spend"] : [],
    });
  }
  {
    const hits = seen(ev, /graph\.facebook\.com\/v\d+\.\d+\/\d*[^"'\s]*\/events|conversions[\s_-]?api|capi_access_token|META_CAPI/i, { web: false });
    checks.push({
      id: "tracking.capi",
      category: "tracking",
      title: "Server-side Conversions API",
      severity: paid && platforms.meta ? "major" : "minor",
      status: hits.length ? "pass" : ev.code.files ? "fail" : "unknown",
      evidence: where(hits) || (ev.code.files ? "No Conversions API calls found in the codebase." : "Needs the codebase or a developer to confirm."),
      why: "Server-side events recover conversions browsers drop; secondary sources put it at 20-30% (09-analytics-attribution, directional).",
      fix: "Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md.",
      owner: "developer",
      fixWith: "out/fixes/meta-pixel.md",
    });
  }
  {
    const hits = seen(ev, /gtag\(|googletagmanager\.com|@vercel\/analytics|plausible\.io\/js|posthog|umami/i);
    checks.push({
      id: "tracking.analytics",
      category: "tracking",
      title: "Site analytics installed",
      severity: "minor",
      status: unknownOr(hits, ""),
      evidence: where(hits) || "No analytics script found.",
      why: "You can't compare landing page conversion against benchmarks (Unbounce medians, 05-conversion) without sessions.",
      fix: "Turn on Vercel Analytics or GA4 (or set the Plausible domain if the code already supports it).",
      owner: "developer",
    });
  }

  // ------------------------------------------------------------ capture
  {
    const hits = seen(ev, /how did you (hear|find)|hdyhau|heard about us|where did you hear/i);
    checks.push({
      id: "capture.hdyhau",
      category: "capture",
      title: "'How did you hear about us' on every high-intent form",
      severity: "major",
      status: unknownOr(hits, ""),
      evidence: where(hits) || "No 'how did you hear about us' field found on forms.",
      why: "Software credited web search with 79% of conversions; buyers named it 3% of the time. Without self-report the engine defunds what works (Refine Labs, 09-analytics-attribution).",
      fix: "Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html.",
      owner: "developer",
      fixWith: "out/fixes/hdyhau-field.html",
    });
  }
  {
    const hits = seen(ev, /type=["']email["']|type:\s*["']email["']|newsletter|early[\s-]?access|subscribe/i);
    checks.push({
      id: "capture.email",
      category: "capture",
      title: "Email capture on the site",
      severity: "major",
      status: unknownOr(hits, ""),
      evidence: where(hits) || "No email capture found.",
      why: "Owned lists are the cheapest repeatable conversions and are immune to social reach collapse (00-synthesis, pattern 7).",
      fix: "Add an email capture with a clear reason to join (weekly picks, early access).",
      owner: "developer",
    });
  }
  if (india) {
    const hits = seen(ev, /wa\.me\/|api\.whatsapp\.com|whatsapp/i);
    checks.push({
      id: "capture.whatsapp",
      category: "capture",
      title: "WhatsApp entry or opt-in",
      severity: ctx.client.playbook === "b2b_service" ? "minor" : "major",
      status: unknownOr(hits, ""),
      evidence: where(hits) || "No WhatsApp entry point or opt-in found.",
      why: "91% of Indian online adults chat with businesses on WhatsApp weekly; Click-to-WhatsApp funnels cut cost per qualified lead in Meta-cited cases (03, 06).",
      fix: "Add a WhatsApp opt-in to forms and a click-to-chat button on landing pages.",
      owner: "developer",
    });
  }

  // ------------------------------------------------------------ response
  {
    const leadDeskOn = on("lead-desk");
    const leadsFlow = ev.engine.env.leadEndpoint || ev.engine.leads.length > 0;
    checks.push({
      id: "response.lead_path",
      category: "response",
      title: "Every lead reaches the engine",
      severity: paid || outbound ? "blocker" : "major",
      status: leadDeskOn && leadsFlow ? "pass" : "fail",
      evidence: `Lead Desk ${leadDeskOn ? "on" : "off"}; lead endpoint ${ev.engine.env.leadEndpoint ? "configured" : "not configured"}; ${ev.engine.leads.length} leads in store.`,
      why: "Speed-to-lead: 19% conversion with an instant reply vs 4% after 3 hours in one India case (vendor-reported, 05-conversion). You can't reply fast to leads you can't see.",
      fix: ctx.client.accounts.leads_feed
        ? `Pull the site's conversions from ${ctx.client.accounts.leads_feed} into the engine (\`mm import feed\`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data.`
        : "Deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT, then point site forms at it, or sync the site's own lead table into the engine (`mm import feed` / `mm import lead`).",
      owner: "developer",
      fixWith: "supabase/functions/lead-intake",
      gates: ["spend", "outbound"],
    });
  }
  {
    const acked = ev.engine.leads.filter((l) => l.ackAt);
    const mins = acked.map((l) => (Date.parse(l.ackAt!) - Date.parse(l.createdAt)) / 60000).filter((x) => x >= 0);
    const med = median(mins);
    checks.push({
      id: "response.speed",
      category: "response",
      title: "Leads acknowledged within 10 minutes",
      severity: "major",
      status: !ev.engine.leads.length ? "unknown" : !acked.length ? "fail" : med <= 10 ? "pass" : "warn",
      evidence: !ev.engine.leads.length ? "No leads yet to measure." : acked.length ? `Median acknowledgement ${med.toFixed(1)} min across ${acked.length} leads.` : `${ev.engine.leads.length} leads, none with an acknowledgement time.`,
      why: "Response speed is one of the most controllable conversion levers (05-conversion).",
      fix: "Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events.",
      owner: "engine",
    });
  }
  checks.push({
    id: "response.alerts",
    category: "response",
    title: "Hot leads alert a human",
    severity: "minor",
    status: ev.engine.env.alertWebhook ? "pass" : "fail",
    evidence: ev.engine.env.alertWebhook ? "MM_ALERT_WEBHOOK set." : "MM_ALERT_WEBHOOK not set.",
    why: "High-intent leads need a human reply the same hour.",
    fix: "Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay).",
    owner: "human",
  });

  // ------------------------------------------------------------ lifecycle
  const flowsByPlaybook: Record<string, { id: string; title: string; re: RegExp; severity: CheckResult["severity"] }[]> = {
    creator_media: [
      { id: "lifecycle.welcome", title: "Welcome flow", re: /welcome/i, severity: "major" },
      { id: "lifecycle.reminder", title: "Pre-event reminder (cuts free-RSVP no-shows)", re: /remind|pre[\s-]?event|drop|before/i, severity: "major" },
      { id: "lifecycle.post_event", title: "Post-event 'next one' loop", re: /post[\s-]?event|next[\s_-]?one|recap|after/i, severity: "minor" },
    ],
    consumer: [
      { id: "lifecycle.welcome", title: "Welcome flow", re: /welcome/i, severity: "major" },
      { id: "lifecycle.cart", title: "Abandoned-cart flow", re: /cart/i, severity: "major" },
      { id: "lifecycle.back_in_stock", title: "Back-in-stock / drop alert", re: /stock|drop/i, severity: "minor" },
    ],
    b2b_service: [
      { id: "lifecycle.nurture", title: "Lead nurture to booked call", re: /nurture|call|follow/i, severity: "major" },
      { id: "lifecycle.no_show", title: "No-show recovery", re: /no[\s_-]?show/i, severity: "minor" },
    ],
  };
  for (const f of flowsByPlaybook[ctx.client.playbook]) {
    const st = flowApproved(ev.engine.assets, f.re);
    checks.push({
      id: f.id,
      category: "lifecycle",
      title: f.title,
      severity: f.severity,
      status: st.approved ? "pass" : st.any ? "warn" : "fail",
      evidence: st.approved ? "Approved flow exists in the engine." : st.any ? "Flow drafted, not approved yet." : "No flow drafted.",
      why: "Flows return many times the revenue per recipient of one-off campaigns; multi-step beats single-step (Klaviyo 2025, 06-lifecycle-retention).",
      fix: st.any ? "Approve the drafted flow (`mm approvals`) and build it in the sending tool." : "Run `mm run lifecycle`, approve, then build it in the sending tool.",
      owner: st.any ? "human" : "engine",
      fixWith: "lifecycle",
    });
  }

  // ------------------------------------------------------------ conversion
  {
    const pages = ev.engine.assets.filter((a) => a.kind === "page" && (a.approval.status === "approved" || a.approval.status === "auto"));
    const capture = checks.find((c) => c.id === "capture.email")?.status === "pass";
    checks.push({
      id: "conversion.destination",
      category: "conversion",
      title: "Paid traffic has somewhere to convert",
      severity: paid ? "blocker" : "minor",
      status: pages.length || capture ? "pass" : haveWebOrCode ? "fail" : "unknown",
      evidence: pages.length ? `${pages.length} approved landing page(s).` : capture ? "Site has a capture form." : "No approved landing page or capture form found.",
      why: "Ad-to-page message match and a single clear action are the basics of conversion (05-conversion).",
      fix: "Run `mm run pages` for the offer and approve it, or point ads at an existing RSVP/signup page.",
      owner: "engine",
      fixWith: "pages",
      gates: paid ? ["spend"] : [],
    });
  }
  {
    const ads = ev.engine.assets.filter((a) => a.kind === "ad" && a.approval.status !== "rejected");
    const adMot = new Set(ads.map((a) => a.tags.motivation).filter(Boolean));
    const pageMot = new Set(ev.engine.assets.filter((a) => a.kind === "page").map((a) => a.tags.motivation).filter(Boolean));
    const unmatched = [...adMot].filter((x) => !pageMot.has(x));
    checks.push({
      id: "conversion.message_match",
      category: "conversion",
      title: "Each ad motivation lands on a matching page",
      severity: "minor",
      status: !ads.length ? "unknown" : unmatched.length === 0 ? "pass" : unmatched.length < adMot.size ? "warn" : "fail",
      evidence: !ads.length ? "No ads yet." : unmatched.length ? `No matching page for: ${unmatched.join(", ")}.` : "All ad motivations have a matching page.",
      why: "Conversion under ~2.5% usually signals a message-match, offer or speed problem (05-conversion, practitioner consensus).",
      fix: "Run `mm run pages --input '{\"motivationId\":\"<id>\",...}'` for the unmatched motivations, or send them to the closest page.",
      owner: "engine",
      fixWith: "pages",
    });
  }
  {
    const home = ev.web.pages[0];
    checks.push({
      id: "conversion.speed",
      category: "conversion",
      title: "Homepage responds fast and light",
      severity: "minor",
      status: !home?.ok ? "unknown" : home.ms < 2500 && home.bytes < 1_500_000 ? "pass" : "warn",
      evidence: home?.ok ? `${home.ms} ms, ${(home.bytes / 1024).toFixed(0)} KB HTML.` : "Live site not reachable from the engine.",
      why: "Slow pages lose mobile visitors before the ad's promise lands.",
      fix: "Check Core Web Vitals; trim the initial HTML/JS on landing routes.",
      owner: "developer",
    });
  }

  // ------------------------------------------------------------ promises
  {
    const snippets: string[] = [];
    const pageFiles = /(^|\/)(pages|app|components|src)\//;
    for (const [path, content] of ev.code.corpus) {
      if (!pageFiles.test(path) || !/\.(tsx|jsx|html)$/.test(path)) continue;
      const re = new RegExp(`.{0,70}${PROMISE_RE.source}.{0,20}`, "gi");
      for (const mt of content.matchAll(re)) snippets.push(`${path}: "${mt[0].replace(/[<>{}]/g, " ").replace(/\s+/g, " ").trim()}"`);
    }
    const webHits = ev.web.text.match(new RegExp(`.{0,70}${PROMISE_RE.source}.{0,20}`, "gi")) ?? [];
    snippets.push(...webHits.slice(0, 5).map((s) => `site: "${s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}"`));
    const critical = snippets.filter((s) => PROMISE_CRITICAL.test(s.replace(/^[^:]+:/, "")));
    snippets.sort((a, b) => Number(PROMISE_CRITICAL.test(b.replace(/^[^:]+:/, ""))) - Number(PROMISE_CRITICAL.test(a.replace(/^[^:]+:/, ""))));
    checks.push({
      id: "promises.coming_soon",
      category: "promises",
      title: "No unkept 'coming soon' promises on money paths",
      severity: critical.length ? "major" : "minor",
      status: !haveWebOrCode ? "unknown" : critical.length ? "fail" : snippets.length ? "warn" : "pass",
      evidence: snippets.length ? snippets.slice(0, 6).join("\n") : "None found.",
      why: "A promise the product doesn't keep (rewards, redemption, tickets) costs trust exactly where paid traffic lands.",
      fix: critical.length ? "Ship the promised feature or remove the promise from the UI before sending traffic." : "Review the listed placeholders; most are harmless empty states.",
      owner: "developer",
    });
  }
  ctx.client.audit.knownIssues.forEach((issue, i) =>
    checks.push({
      id: `promises.known_${i + 1}`,
      category: "promises",
      title: `Known leak: ${issue.slice(0, 70)}`,
      severity: "major",
      status: "fail",
      evidence: "Listed in client.yaml audit.knownIssues.",
      why: "Known leaks waste traffic until fixed; fixing them is the most certain win in the plan.",
      fix: issue,
      owner: "developer",
    }),
  );

  // ------------------------------------------------------------ discoverability
  {
    const live = ev.web.llms?.ok && ev.web.llms.html.length > 50;
    const file = codeHasFile(ev, /(^|\/)public\/llms(-full)?\.txt$/);
    checks.push({
      id: "geo.llms_txt",
      category: "discoverability",
      title: "llms.txt published",
      severity: "minor",
      status: live || file ? "pass" : haveWebOrCode ? "fail" : "unknown",
      evidence: live ? "Live at /llms.txt." : file ? `Found ${file}.` : "No llms.txt found.",
      why: "AI answers increasingly drive discovery; make it easy for them to describe you correctly (02-inbound-seo-geo).",
      fix: "Publish the draft in out/fixes/llms.txt.",
      owner: "developer",
      fixWith: "out/fixes/llms.txt",
    });
  }
  {
    const hits = seen(ev, /application\/ld\+json/i);
    checks.push({
      id: "geo.jsonld",
      category: "discoverability",
      title: "Structured data (JSON-LD)",
      severity: "minor",
      status: unknownOr(hits, ""),
      evidence: where(hits) || "No JSON-LD found.",
      why: "Structured data helps search and AI answers read events, organisations and FAQs (02-inbound-seo-geo).",
      fix: "Add Organization + Event/Service JSON-LD. Template in out/fixes/organization.jsonld.",
      owner: "developer",
      fixWith: "out/fixes/organization.jsonld",
    });
  }
  {
    const robots = ev.web.robots?.ok || Boolean(codeHasFile(ev, /(^|\/)public\/robots\.txt$/)) || ev.code.paths.some((p) => /robots\.(ts|js)$/.test(p));
    const sitemap = ev.web.sitemap?.ok || ev.code.paths.some((p) => /sitemap/i.test(p)) || seen(ev, /sitemap/i, { web: false }).length > 0;
    checks.push({
      id: "geo.robots_sitemap",
      category: "discoverability",
      title: "robots.txt and sitemap",
      severity: "minor",
      status: robots && sitemap ? "pass" : haveWebOrCode ? "warn" : "unknown",
      evidence: `robots.txt ${robots ? "found" : "missing"}; sitemap ${sitemap ? "found" : "missing"}.`,
      why: "Crawlers (search and AI) need to find every event and artist page.",
      fix: "Generate a sitemap covering events, artists and guides; reference it in robots.txt.",
      owner: "developer",
    });
  }

  // ------------------------------------------------------------ deliverability (outbound only)
  if (outbound) {
    const domains = Object.entries(ev.dns.domains);
    const mainDomain = ctx.client.url?.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    checks.push({
      id: "deliverability.domains",
      category: "deliverability",
      title: "Separate sending domains for cold email",
      severity: "blocker",
      status: domains.length && !domains.some(([d]) => d === mainDomain) ? "pass" : "fail",
      evidence: domains.length ? `Sending domains: ${domains.map(([d]) => d).join(", ")}.` : "No sending domains in client.yaml audit.sendingDomains.",
      why: "Cold email from your main domain risks the domain that carries your real mail (04-outbound-leadgen).",
      fix: "Buy 2-3 lookalike domains, add them to audit.sendingDomains, and warm them for 2+ weeks.",
      owner: "human",
      gates: ["outbound"],
    });
    for (const [d, r] of domains) {
      checks.push({
        id: `deliverability.spf.${d}`,
        category: "deliverability",
        title: `SPF on ${d}`,
        severity: "blocker",
        status: !r.reachable ? "unknown" : r.spf ? "pass" : "fail",
        evidence: r.reachable ? r.spf ?? "No SPF record." : "DNS not reachable from the engine.",
        why: "Google, Yahoo and Microsoft reject unauthenticated bulk mail (Microsoft enforcing since May 2025; 04-outbound-leadgen).",
        fix: `Add a TXT record on ${d}: v=spf1 include:<your sender> ~all`,
        owner: "human",
        gates: ["outbound"],
      });
      const p = r.dmarc?.match(/p=(\w+)/i)?.[1]?.toLowerCase();
      checks.push({
        id: `deliverability.dmarc.${d}`,
        category: "deliverability",
        title: `DMARC on ${d}`,
        severity: "blocker",
        status: !r.reachable ? "unknown" : !r.dmarc ? "fail" : p === "none" ? "warn" : "pass",
        evidence: r.reachable ? r.dmarc ?? "No DMARC record." : "DNS not reachable from the engine.",
        why: "DMARC is required for bulk senders; keep spam complaints under 0.1% (04-outbound-leadgen).",
        fix: `Add a TXT record at _dmarc.${d}: v=DMARC1; p=quarantine; rua=mailto:dmarc@${d}`,
        owner: "human",
        gates: ["outbound"],
      });
    }
    checks.push({
      id: "deliverability.warmup",
      category: "deliverability",
      title: "Mailboxes warmed 2+ weeks",
      severity: "major",
      status: "unknown",
      evidence: "The engine can't see warm-up state; attest it in client.yaml audit.attest.",
      why: "New mailboxes that start at volume land in spam (04-outbound-leadgen).",
      fix: "Warm each mailbox for 2+ weeks, then cap at 15-25 sends per mailbox per day.",
      owner: "human",
      gates: ["outbound"],
    });
  }

  // ------------------------------------------------------------ strategy + machine
  const approved = (kind: string) => ev.engine.assets.some((a) => a.kind === kind && a.approval.status === "approved");
  checks.push({
    id: "strategy.approved",
    category: "strategy",
    title: "Strategy approved by a human",
    severity: "blocker",
    status: approved("strategy") ? "pass" : "fail",
    evidence: approved("strategy") ? "Approved." : "Strategy waiting in `mm approvals`.",
    why: "Spend follows strategy; nothing ships on an unapproved positioning.",
    fix: "Review research/strategy.md and approve it.",
    owner: "human",
    gates: ["spend", "outbound"],
  });
  checks.push({
    id: "strategy.machine_approved",
    category: "strategy",
    title: "Machine and caps approved",
    severity: "blocker",
    status: approved("machine") ? "pass" : "fail",
    evidence: approved("machine") ? "Approved." : "machine.yaml waiting in `mm approvals`.",
    why: "Caps and autonomy levels are what make it safe to let the engine act.",
    fix: "Review machine.yaml and approve it.",
    owner: "human",
    gates: ["spend", "outbound"],
  });
  if (paid) {
    checks.push({
      id: "strategy.daily_cap",
      category: "strategy",
      title: "Daily spend cap set",
      severity: "blocker",
      status: (m?.budgets.dailyCap ?? 0) > 0 ? "pass" : "fail",
      evidence: `Daily cap ${m?.budgets.dailyCap ?? 0} ${ctx.client.currency}.`,
      why: "Hard caps are the guardrail no autonomy level overrides.",
      fix: "Set budgets.dailyCap in machine.yaml.",
      owner: "human",
      gates: ["spend"],
    });
    for (const k of (["meta", "linkedin", "google"] as const).filter((x) => platforms[x])) {
      const key = `${k}_ad_account`;
      checks.push({
        id: `strategy.${key}`,
        category: "strategy",
        title: `${k[0].toUpperCase() + k.slice(1)} ad account in client.yaml`,
        severity: "major",
        status: ctx.client.accounts[key] ? "pass" : "fail",
        evidence: ctx.client.accounts[key] ? `${key}: ${ctx.client.accounts[key]}.` : `accounts.${key} not set.`,
        why: "The Media Buyer can't build paused campaigns or read results without it.",
        fix: `Add accounts.${key} to client.yaml${k === "meta" ? " (act_<id>)" : ""}.`,
        owner: "human",
      });
    }
  }
  if (on("voice")) {
    for (const v of ctx.client.voices) {
      const chars = ev.engine.voiceCorpusChars[v.id] ?? 0;
      checks.push({
        id: `strategy.voice_corpus.${v.id}`,
        category: "strategy",
        title: `Writing samples for ${v.name}`,
        severity: "minor",
        status: chars >= 1500 ? "pass" : chars > 0 ? "warn" : "fail",
        evidence: `${chars} characters in voice/${v.id}.md.`,
        why: "Copy that reads as AI underperforms; human-edited, voice-matched copy wins (04, 10).",
        fix: `Paste 10-20 real posts or messages by ${v.name} into voice/${v.id}.md.`,
        owner: "human",
      });
    }
  }

  // attestations: a human confirms what the engine can't see
  return checks.map((c) => {
    const note = ctx.client.audit.attest[c.id];
    const out: CheckResult = { ...c, gates: c.gates ?? [] };
    if (note && c.status !== "pass") return { ...out, status: "pass", evidence: `Attested: ${note}. (${c.evidence})` };
    return out;
  });
}

const W = { blocker: 3, major: 2, minor: 1 } as const;
const V = { pass: 1, warn: 0.5, fail: 0, unknown: 0 } as const;

export function score(checks: CheckResult[]): number {
  const tot = checks.reduce((a, c) => a + W[c.severity], 0);
  const got = checks.reduce((a, c) => a + W[c.severity] * V[c.status], 0);
  return tot ? Math.round((100 * got) / tot) : 0;
}

export function gateOpen(checks: CheckResult[], gate: "spend" | "outbound"): { open: boolean; blockers: CheckResult[] } {
  const blockers = checks.filter((c) => c.gates.includes(gate) && c.severity === "blocker" && c.status !== "pass" && c.status !== "warn");
  return { open: blockers.length === 0, blockers };
}
