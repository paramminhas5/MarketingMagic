// Decision statistics. Small budgets make "winner" calls noisy, so the engine
// uses Bayesian probability-of-being-best instead of eyeballing averages, and
// does budget arithmetic before it promises any test can conclude.

/** Deterministic PRNG so the same data always gives the same decision. */
export function rng(seed = 42) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) via Marsaglia-Tsang. */
export function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(rand(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function beta(a: number, b: number, rand: () => number) {
  const x = gamma(a, rand);
  return x / (x + gamma(b, rand));
}

export interface SpendArm {
  id: string;
  spend: number;
  results: number;
}

/**
 * P(arm has the lowest cost per result). Results ~ Poisson(rate * spend),
 * rate ~ Gamma(results + 1, spend) with a weak prior. Returns id -> probability.
 */
export function probBestCost(arms: SpendArm[], draws = 4000, seed = 7): Record<string, number> {
  const live = arms.filter((a) => a.spend > 0);
  const wins: Record<string, number> = Object.fromEntries(arms.map((a) => [a.id, 0]));
  if (live.length === 0) return wins;
  const rand = rng(seed);
  for (let i = 0; i < draws; i++) {
    let best = "";
    let bestRate = -1;
    for (const a of live) {
      const rate = gamma(a.results + 1, rand) / a.spend;
      if (rate > bestRate) {
        bestRate = rate;
        best = a.id;
      }
    }
    wins[best]++;
  }
  return Object.fromEntries(Object.entries(wins).map(([k, v]) => [k, v / draws]));
}

export interface RateArm {
  id: string;
  trials: number;
  successes: number;
}

/** P(arm has the highest conversion rate), Beta(1,1) prior. */
export function probBestRate(arms: RateArm[], draws = 4000, seed = 11): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(arms.map((a) => [a.id, 0]));
  if (!arms.length) return wins;
  const rand = rng(seed);
  for (let i = 0; i < draws; i++) {
    let best = arms[0].id;
    let bestP = -1;
    for (const a of arms) {
      const p = beta(a.successes + 1, a.trials - a.successes + 1, rand);
      if (p > bestP) {
        bestP = p;
        best = a.id;
      }
    }
    wins[best]++;
  }
  return Object.fromEntries(Object.entries(wins).map(([k, v]) => [k, v / draws]));
}

/** The call the engine makes from probability-best. */
export function verdict(p: number, results: number, minResults = 30): "winner" | "leading" | "losing" | "too_early" {
  if (results < Math.min(10, minResults)) return "too_early";
  if (p >= 0.9 && results >= minResults) return "winner";
  if (p >= 0.6) return "leading";
  if (p <= 0.05) return "losing";
  return "too_early";
}

/** How many arms a budget can test to a conclusion. */
export function testCapacity(opts: {
  budget: number;
  costPerResult: number;
  minResultsPerArm?: number;
}): { resultsAffordable: number; armsTestable: number; daysPerDecision: (dailySpend: number, arms: number) => number } {
  const min = opts.minResultsPerArm ?? 30;
  const resultsAffordable = Math.floor(opts.budget / opts.costPerResult);
  return {
    resultsAffordable,
    armsTestable: Math.floor(resultsAffordable / min),
    daysPerDecision: (dailySpend, arms) => Math.ceil((arms * min * opts.costPerResult) / Math.max(dailySpend, 1)),
  };
}

export const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
