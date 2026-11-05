// Thin, optional API adapters for headless runs. Inside a Claude session the
// connectors (Meta Ads, Apollo, Clay, Ahrefs, Semrush...) do this work instead
// and drop their results into clients/<slug>/inputs/<product>/.

export async function fetchText(url: string, maxChars = 6000): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "MarketingMagic/0.1" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return `[fetch ${url} failed: ${res.status}]`;
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  } catch (e) {
    return `[fetch ${url} failed: ${(e as Error).message}]`;
  }
}

// ---------------------------------------------------------------- Meta Graph API

const GRAPH = "https://graph.facebook.com/v23.0";

export const hasMeta = () => Boolean(process.env.META_ACCESS_TOKEN);

async function graph(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET") {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN not set");
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(method === "GET" ? `${GRAPH}/${path}?${qs}` : `${GRAPH}/${path}`, {
    method,
    body: method === "POST" ? qs : undefined,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Meta ${path}: ${JSON.stringify(json.error ?? json)}`);
  return json;
}

export async function metaAdLibrary(searchTerms: string, country = "IN", limit = 25) {
  return graph("ads_archive", {
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify([country]),
    ad_active_status: "ACTIVE",
    fields: "page_name,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,publisher_platforms",
    limit: String(limit),
  });
}

export async function metaInsights(adAccountId: string, datePreset = "last_7d") {
  return graph(`${adAccountId}/insights`, {
    level: "ad",
    date_preset: datePreset,
    time_increment: "1",
    fields: "ad_id,ad_name,spend,impressions,clicks,frequency,actions,action_values",
    limit: "500",
  });
}

/** Creates a campaign shell, always PAUSED. Activation is a human decision (A2). */
export async function metaCreatePausedCampaign(adAccountId: string, name: string, objective: string) {
  return graph(
    `${adAccountId}/campaigns`,
    { name, objective, status: "PAUSED", special_ad_categories: "[]" },
    "POST",
  );
}

export async function metaSetStatus(objectId: string, status: "PAUSED" | "ACTIVE") {
  return graph(objectId, { status }, "POST");
}

// ---------------------------------------------------------------- Apollo

export const hasApollo = () => Boolean(process.env.APOLLO_API_KEY);

export async function apolloPeopleSearch(filters: Record<string, unknown>) {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not set");
  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ per_page: 25, ...filters }),
  });
  if (!res.ok) throw new Error(`Apollo search: ${res.status} ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------- alerts

export async function alert(text: string) {
  const hook = process.env.MM_ALERT_WEBHOOK;
  if (!hook) return false;
  await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  return true;
}
