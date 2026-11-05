import { defineProduct, z, Strategy, system, asJson, requireDoc, makeAsset, writeFile } from "@mm/core";

const Input = z.object({
  offer: z.string().describe("What the page sells or captures"),
  source: z.enum(["meta", "email", "search", "linkedin", "whatsapp", "organic"]).default("meta"),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  motivationId: z.string().optional().describe("Match the page to the ad's motivation"),
  whatsappNumber: z.string().optional().describe("E.164 without +, for a click-to-chat button"),
});

const Answer = z.object({
  slug: z.string(),
  headline: z.string(),
  subhead: z.string(),
  bullets: z.array(z.string()).max(5),
  proof: z.array(z.string()).describe("Only proof the client actually has; leave empty rather than invent"),
  cta: z.string(),
  formFields: z.array(z.enum(["name", "email", "phone", "company", "message", "city"])),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).max(6),
  hdyhauLabel: z.string().describe("The 'how did you hear about us' question, phrased for this audience"),
  variantB: z.object({ headline: z.string(), cta: z.string() }).describe("One A/B variant to test first"),
});

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(a: z.infer<typeof Answer>, opts: { client: string; colors: string[]; endpoint: string; whatsapp?: string; source: string }) {
  const [c1 = "#111111", c2 = "#f2efe6"] = opts.colors;
  const fields = a.formFields
    .map((f) => {
      if (f === "message") return `<label>${f}<textarea name="message" rows="3"></textarea></label>`;
      const type = f === "email" ? "email" : f === "phone" ? "tel" : "text";
      return `<label>${f}<input name="${f}" type="${type}" required /></label>`;
    })
    .join("\n      ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(a.headline)}</title>
<meta name="description" content="${esc(a.subhead)}" />
<style>
  :root { --ink:${c1}; --paper:${c2}; }
  * { box-sizing: border-box; }
  body { margin:0; font: 17px/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: var(--paper); }
  main { max-width: 680px; margin: 0 auto; padding: 48px 16px 80px; }
  h1 { font-size: clamp(32px, 6vw, 52px); line-height: 1.05; margin: 0 0 16px; letter-spacing: -0.02em; }
  .sub { font-size: 20px; opacity: .8; margin-bottom: 28px; }
  ul { padding-left: 20px; } li { margin: 6px 0; }
  form { display: grid; gap: 12px; margin: 32px 0; padding: 20px; border: 2px solid var(--ink); }
  label { display: grid; gap: 4px; font-size: 14px; text-transform: capitalize; }
  input, textarea { font: inherit; padding: 10px; border: 1px solid var(--ink); background: #fff; }
  button, .wa { font: inherit; font-weight: 700; padding: 14px; border: 0; background: var(--ink); color: var(--paper); cursor: pointer; text-align: center; text-decoration: none; display: block; }
  .wa { background: #25D366; color: #08130c; margin-top: 8px; }
  .proof { border-left: 4px solid var(--ink); padding-left: 12px; margin: 24px 0; }
  details { border-top: 1px solid currentColor; padding: 12px 0; } summary { cursor: pointer; font-weight: 600; }
  .ok { display:none; font-weight:700; }
</style>
</head>
<body>
<main>
  <h1 data-variant-a="${esc(a.headline)}" data-variant-b="${esc(a.variantB.headline)}">${esc(a.headline)}</h1>
  <p class="sub">${esc(a.subhead)}</p>
  <ul>${a.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
  ${a.proof.map((p) => `<p class="proof">${esc(p)}</p>`).join("\n  ")}
  <form id="lead">
      ${fields}
      <label>${esc(a.hdyhauLabel)} *<textarea name="hdyhau" rows="2" required></textarea></label>
      <button type="submit">${esc(a.cta)}</button>
      ${opts.whatsapp ? `<a class="wa" href="https://wa.me/${opts.whatsapp}?text=${encodeURIComponent("Hi! I came from your page: " + a.headline)}">Chat on WhatsApp instead</a>` : ""}
      <p class="ok" id="ok">Got it. You'll hear from us within minutes.</p>
  </form>
  ${a.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n  ")}
</main>
<script>
(function(){
  var p = new URLSearchParams(location.search), utm = {};
  ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid"].forEach(function(k){ if(p.get(k)) utm[k]=p.get(k); });
  if (p.get("v") === "b") { var h=document.querySelector("h1"); h.textContent=h.dataset.variantB; document.querySelector("button").textContent=${JSON.stringify(a.variantB.cta)}; }
  document.getElementById("lead").addEventListener("submit", function(e){
    e.preventDefault();
    var d = Object.fromEntries(new FormData(e.target).entries());
    var body = { client: ${JSON.stringify(opts.client)}, page: ${JSON.stringify(a.slug)}, variant: p.get("v")||"a", source: ${JSON.stringify(opts.source)}, utm: utm, lead: d };
    fetch(${JSON.stringify(opts.endpoint)}, { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(body) })
      .catch(function(){}).finally(function(){ document.getElementById("ok").style.display="block"; e.target.querySelector("button").disabled=true; });
  });
})();
</script>
</body>
</html>
`;
}

export default defineProduct({
  manifest: {
    id: "pages",
    name: "Pages",
    job: "Build message-matched landing pages with a required 'how did you hear about us' field, WhatsApp entry and an A/B variant.",
    defaultAutonomy: "A2",
    defaultSchedule: "on-demand (per offer x source)",
    reads: ["research/strategy.json", "client.yaml brand"],
    writes: ["out/pages/<slug>.html", "assets(kind=page)"],
    connectors: ["Vercel (deploy)", "Supabase (lead-intake function receives the form)"],
    apis: ["MM_LEAD_ENDPOINT"],
    skill: {
      gather: ["Know the offer, the traffic source and which ad motivation it follows."],
      act: [
        "Run `mm run pages --client <slug> --input '{\"offer\":\"...\",\"source\":\"meta\"}'`.",
        "After approval, deploy out/pages/<slug>.html with Vercel (or drop it into the client's site). Variant B is ?v=b.",
      ],
    },
    evidence: ["05-conversion", "09-analytics-attribution"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    return { strategy };
  },

  think(ctx, input, ev) {
    const mot = ev.strategy.motivations.find((m) => m.id === input.motivationId);
    return {
      name: "pages.landing",
      schema: Answer,
      system: system(ctx, "Pages, a conversion copywriter", ["conversion", "analytics"], [
        "Message match: the headline must continue the promise of the ad or email that sent the visitor.",
        "Fewest fields that still qualify. In India, phone + WhatsApp beats long forms on mobile.",
        "The 'how did you hear about us' field is required and free text; phrase it naturally.",
        "No invented proof. If the client has none, leave proof empty and lean on specifics.",
      ]),
      prompt: [
        `Offer: ${input.offer}`,
        `Traffic source: ${input.source}`,
        mot ? asJson("motivation_to_match", mot) : "",
        asJson("positioning", ev.strategy.positioning),
        input.slug ? `Use slug: ${input.slug}` : "",
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, _ev, answer) {
    const a = Answer.parse(answer);
    const slug = input.slug ?? a.slug;
    const html = render(
      { ...a, slug },
      {
        client: ctx.client.slug,
        colors: ctx.client.brand.colors,
        endpoint: process.env.MM_LEAD_ENDPOINT || "/api/lead",
        whatsapp: input.whatsappNumber,
        source: input.source,
      },
    );
    const file = ctx.path("out", "pages", `${slug}.html`);
    writeFile(file, html);
    const asset = makeAsset(ctx, "pages", {
      kind: "page",
      channel: "web",
      title: a.headline,
      body: [a.subhead, ...a.bullets, a.cta].join("\n"),
      tags: { motivation: input.motivationId },
      meta: { slug, file, source: input.source, variantB: a.variantB },
    });
    await ctx.store.insert("assets", asset);
    return { asset, file };
  },

  summarize: (o) => `page ${o.asset.meta.slug} -> ${o.file}`,
});
