// Ready-to-ship artifacts for the most common failing checks. The engine writes
// them to clients/<slug>/out/fixes/ so a developer (or a Claude session with the
// client's repo) can drop them in.
import { writeFile, type CheckResult, type Ctx, type Strategy } from "@mm/core";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function writeFixKit(ctx: Ctx, checks: CheckResult[], strategy?: Strategy): string[] {
  const failing = new Set(checks.filter((c) => c.status !== "pass").map((c) => c.id));
  const c = ctx.client;
  const out: string[] = [];
  const put = (name: string, body: string) => {
    writeFile(ctx.path("out", "fixes", name), body);
    out.push(`out/fixes/${name}`);
  };

  if (failing.has("capture.hdyhau")) {
    put(
      "hdyhau-field.html",
      `<!-- Required free-text "how did you hear about us". Free text beats a dropdown: people name the podcast, the post, the friend, the AI assistant. -->
<label for="hdyhau">How did you hear about ${esc(c.name)}? *</label>
<textarea id="hdyhau" name="hdyhau" rows="2" required placeholder="A friend, a post, a DJ, ChatGPT... be specific"></textarea>

<!-- React / TSX -->
<!--
<label htmlFor="hdyhau">How did you hear about ${esc(c.name)}? *</label>
<textarea id="hdyhau" name="hdyhau" rows={2} required
  value={hdyhau} onChange={(e) => setHdyhau(e.target.value)}
  placeholder="A friend, a post, a DJ, ChatGPT... be specific" />
// include { hdyhau } in the payload sent to your API and on to MM_LEAD_ENDPOINT
-->
`,
    );
  }

  if (failing.has("tracking.meta_pixel") || failing.has("tracking.capi")) {
    put(
      "meta-pixel.md",
      `# Meta pixel + Conversions API for ${c.name}

1. Events Manager → create/choose the dataset (pixel) for ${c.name}. Copy the pixel ID.
2. Browser: add the base code once per page (Next.js: in _app or layout via next/script, strategy="afterInteractive").

\`\`\`html
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
\`\`\`

3. Fire the real conversion where it happens, with an event_id you also send server-side:
   - ${c.playbook === "creator_media" ? "RSVP / signup: `fbq('track', 'CompleteRegistration', {}, {eventID})`" : c.playbook === "b2b_service" ? "Form submit: `fbq('track', 'Lead', {}, {eventID})`" : "Checkout: `fbq('track', 'Purchase', {value, currency: '" + c.currency + "'}, {eventID})`"}
4. Server: POST the same event to https://graph.facebook.com/v23.0/<PIXEL_ID>/events with access_token, the same event_id, hashed email/phone, client IP and user agent. Dedup happens on event_id.
5. Verify in Events Manager → Test events. Then set the campaign's optimisation event to this conversion.
`,
    );
  }

  if (failing.has("geo.llms_txt")) {
    const pos = strategy?.positioning;
    put(
      "llms.txt",
      `# ${c.name}

> ${pos?.statement ?? c.description.trim().split(". ")[0]}

${c.description.trim()}

## What we offer
${c.offers.map((o) => `- ${o.name}${o.price ? ` (${o.price})` : ""}: ${o.description}`).join("\n")}

## Who it's for
${pos?.bestFitCustomer ?? c.icp ?? ""}

## Where
${c.geo.join(", ")}

## Links
- Website: ${c.url ?? ""}
`,
    );
  }

  if (failing.has("geo.jsonld")) {
    const org = {
      "@context": "https://schema.org",
      "@type": c.playbook === "b2b_service" ? "ProfessionalService" : "Organization",
      name: c.name,
      url: c.url,
      description: c.description.trim().split(". ").slice(0, 2).join(". "),
      areaServed: c.geo,
      sameAs: Object.values(c.accounts).filter((v) => /^https?:\/\//.test(v)),
    };
    const extra =
      c.playbook === "creator_media"
        ? {
            "@context": "https://schema.org",
            "@type": "MusicEvent",
            name: "EVENT NAME",
            startDate: "2026-12-13T20:00:00+05:30",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: { "@type": "Place", name: "VENUE", address: c.geo[0] },
            organizer: { "@type": "Organization", name: c.name, url: c.url },
            offers: { "@type": "Offer", price: "0", priceCurrency: c.currency, availability: "https://schema.org/LimitedAvailability", url: "RSVP URL" },
          }
        : undefined;
    put("organization.jsonld", JSON.stringify(extra ? [org, extra] : org, null, 2));
  }
  return out;
}

export function openingPlaybook(ctx: Ctx, checks: CheckResult[]): string {
  const sev = { blocker: 0, major: 1, minor: 2 } as const;
  const own = { engine: 0, human: 1, developer: 2 } as const;
  const todo = checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => sev[a.severity] - sev[b.severity] || own[a.owner] - own[b.owner]);
  const group = (o: CheckResult["owner"]) => todo.filter((c) => c.owner === o);
  const line = (c: CheckResult) => `- [ ] **${c.title}** (${c.severity}${c.gates.length ? `, blocks ${c.gates.join("+")}` : ""}) · ${c.fix}${c.fixWith ? ` → \`${c.fixWith}\`` : ""}`;
  return [
    `# Opening playbook · ${ctx.client.name}`,
    "Fix leaks before buying traffic. These recover demand you already have, which makes them the most certain wins available. Blockers first.",
    `## The engine can do now (${group("engine").length})\n${group("engine").map(line).join("\n") || "- nothing"}`,
    `## Needs you (${group("human").length})\n${group("human").map(line).join("\n") || "- nothing"}`,
    `## Needs a developer (${group("developer").length})\n${group("developer").map(line).join("\n") || "- nothing"}`,
  ].join("\n\n");
}
