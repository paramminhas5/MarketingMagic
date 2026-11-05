// Supabase Edge Function: lead-intake
// Landing pages (products/pages) POST here. In under a second it:
//   1. stores the lead (with the free-text "how did you hear about us" answer)
//   2. sends an instant acknowledgement if RESEND_API_KEY is set
//   3. pings MM_ALERT_WEBHOOK so a human (or the Lead Desk) picks it up
// Lead Desk then codes, scores and drafts the real reply (mm cycle / scheduled).
//
// Deploy: supabase functions deploy lead-intake --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, [RESEND_API_KEY, MM_FROM_EMAIL], [MM_ALERT_WEBHOOK], MM_ALLOWED_CLIENTS
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

  let body: { client?: string; page?: string; variant?: string; source?: string; utm?: Record<string, string>; lead?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400, headers: cors });
  }
  const allowed = (Deno.env.get("MM_ALLOWED_CLIENTS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const client = body.client ?? "";
  if (!client || (allowed.length && !allowed.includes(client))) return new Response("unknown client", { status: 400, headers: cors });

  const l = body.lead ?? {};
  const id = `lead_${crypto.randomUUID().slice(0, 8)}`;
  const lead = {
    id,
    client,
    source: body.source ?? "form",
    name: l.name,
    email: l.email,
    phone: l.phone,
    company: l.company,
    message: l.message,
    hdyhauRaw: l.hdyhau,
    utm: { ...(body.utm ?? {}), page: body.page ?? "", variant: body.variant ?? "a" },
    status: "new",
    createdAt: new Date().toISOString(),
  };

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await db.from("mm_leads").insert({ id, client, data: lead });
  if (error) return new Response(`store failed: ${error.message}`, { status: 500, headers: cors });

  const tasks: Promise<unknown>[] = [];
  const resend = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MM_FROM_EMAIL");
  if (resend && from && lead.email) {
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: lead.email,
          subject: "Got it",
          text: `Hi${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}, thanks for reaching out. A real person will reply shortly.`,
        }),
      }),
    );
  }
  const hook = Deno.env.get("MM_ALERT_WEBHOOK");
  if (hook) {
    tasks.push(
      fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `New ${client} lead: ${lead.name ?? ""} ${lead.email ?? lead.phone ?? ""} · heard via: ${lead.hdyhauRaw ?? "-"}` }),
      }),
    );
  }
  await Promise.allSettled(tasks);
  return new Response(JSON.stringify({ ok: true, id }), { headers: { ...cors, "content-type": "application/json" } });
});
