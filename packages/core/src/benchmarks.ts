// Benchmarks from the Phase 1 research (playbooks/). Every figure carries its source
// so a memo that says "below benchmark" can say whose benchmark. Most are US/global;
// India-specific data is scarce and flagged where it exists.

export interface Benchmark {
  id: string;
  metric: string;
  /** Median / average unless noted */
  value: number;
  unit: "%" | "USD" | "INR" | "x" | "events/week";
  /** Higher is better? */
  higherIsBetter: boolean;
  scope: string;
  source: string;
  playbook: string;
}

export const BENCHMARKS: Benchmark[] = [
  // conversion [05]
  { id: "lp_cvr_all", metric: "Landing page conversion rate", value: 6.6, unit: "%", higherIsBetter: true, scope: "all verticals, median", source: "Unbounce, 41,000 pages (2023-24)", playbook: "05-conversion" },
  { id: "lp_cvr_events", metric: "Landing page conversion rate", value: 12.3, unit: "%", higherIsBetter: true, scope: "events & entertainment, median", source: "Unbounce (2023-24)", playbook: "05-conversion" },
  { id: "lp_cvr_saas", metric: "Landing page conversion rate", value: 3.8, unit: "%", higherIsBetter: true, scope: "SaaS, median", source: "Unbounce (2023-24)", playbook: "05-conversion" },
  { id: "lp_cvr_ecom", metric: "Landing page conversion rate", value: 4.2, unit: "%", higherIsBetter: true, scope: "ecommerce, median", source: "Unbounce (2023-24)", playbook: "05-conversion" },
  { id: "lp_cvr_services", metric: "Landing page conversion rate", value: 6.1, unit: "%", higherIsBetter: true, scope: "professional services, median", source: "Unbounce (2023-24)", playbook: "05-conversion" },
  { id: "meta_lead_cvr", metric: "Meta lead-ad conversion rate", value: 7.72, unit: "%", higherIsBetter: true, scope: "US, all industries", source: "WordStream/LocaliQ 2025", playbook: "03-paid-acquisition" },
  // lifecycle [06]
  { id: "flow_rpr_cart", metric: "Abandoned-cart flow revenue per recipient", value: 3.07, unit: "USD", higherIsBetter: true, scope: "Klaviyo average", source: "Klaviyo 2025 Benchmark Report", playbook: "06-lifecycle-retention" },
  { id: "flow_rpr_welcome", metric: "Welcome flow revenue per recipient", value: 2.35, unit: "USD", higherIsBetter: true, scope: "Klaviyo average", source: "Klaviyo 2025 Benchmark Report", playbook: "06-lifecycle-retention" },
  { id: "newsletter_auto_ctr", metric: "Newsletter automation CTR", value: 13.48, unit: "%", higherIsBetter: true, scope: "beehiiv network", source: "beehiiv 2025 State of Newsletters", playbook: "06-lifecycle-retention" },
  // outbound [04]
  { id: "cold_reply", metric: "Cold email reply rate", value: 3.43, unit: "%", higherIsBetter: true, scope: "average; top quartile 5.5%+", source: "Instantly 2026 benchmark", playbook: "04-outbound-leadgen" },
  { id: "bounce_max", metric: "Bounce rate ceiling", value: 2, unit: "%", higherIsBetter: false, scope: "pause sending above this", source: "Instantly 2026 / sender rules", playbook: "04-outbound-leadgen" },
  // paid [03]
  { id: "tla_lp_ctr", metric: "LinkedIn Thought Leader Ad landing-page CTR", value: 0.43, unit: "%", higherIsBetter: true, scope: "landing-page clicks only", source: "Kiin within-account study", playbook: "03-paid-acquisition" },
  { id: "meta_learning_events", metric: "Optimisation events to exit Meta's learning phase", value: 50, unit: "events/week", higherIsBetter: true, scope: "per ad set, within 7 days", source: "Meta Business Help Center: About the learning phase", playbook: "03-paid-acquisition" },
  // social [07]
  { id: "ig_carousel_er", metric: "Instagram carousel engagement rate", value: 0.55, unit: "%", higherIsBetter: true, scope: "brands, 2025", source: "Socialinsider 2025", playbook: "07-social-short-form" },
  { id: "ig_reels_er", metric: "Instagram Reels engagement rate", value: 0.52, unit: "%", higherIsBetter: true, scope: "brands, 2025", source: "Socialinsider 2025", playbook: "07-social-short-form" },
];

export const benchmark = (id: string) => BENCHMARKS.find((b) => b.id === id);

export function compare(id: string, actual: number): { benchmark: Benchmark; ratio: number; verdict: "above" | "near" | "below" } | undefined {
  const b = benchmark(id);
  if (!b) return undefined;
  const ratio = b.higherIsBetter ? actual / b.value : b.value / Math.max(actual, 1e-9);
  return { benchmark: b, ratio, verdict: ratio >= 1.1 ? "above" : ratio >= 0.8 ? "near" : "below" };
}

/** Landing-page benchmark that fits a playbook. */
export function lpBenchmarkFor(playbook: string): string {
  return playbook === "creator_media" ? "lp_cvr_events" : playbook === "b2b_service" ? "lp_cvr_services" : "lp_cvr_ecom";
}
