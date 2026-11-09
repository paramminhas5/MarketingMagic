# Test plan · Cats Can Dance · 2026-11-09

Budget 10000 INR/month, daily cap 700. Basis: **scenarios**.

## Recommendation: test

Test **3** motivation(s) this month: room-that-listens, the-sound, free-but-capped. ~111 INR/day each. First decision in ~27 days.

- Testing 3 motivations at a time; more would split the budget too thin to call any of them.
- Below Meta's ~50 optimisation events a week, so expect "learning limited": keep one consolidated campaign and ad set, broad targeting, and don't edit it daily.
- No results yet: these are scenarios, not forecasts. The plan switches to observed costs automatically after 10+ results.

**Structure:** One campaign, one broad ad set per tested motivation (or one ad set with all, Advantage+), 3 distinct formats per motivation.

**Decision rule:** Call a winner when it has ≥30 results and ≥90% probability of the lowest cost per result (Bayesian). Below that it is 'leading' or 'too early', never a winner.

**Kill rule:** Pause any ad that spends 2x the target cost with zero results, or runs >1.5x target cost after 3x target spend.

## What the budget can learn
| cost per result | results/month | angles testable to 30 results | clears Meta learning phase |
|---|---|---|---|
| 25 INR | 400 | 13 | yes |
| 50 INR | 200 | 6 | no |
| 100 INR | 100 | 3 | no |
| 200 INR | 50 | 1 | no |
| 400 INR | 25 | 0 | no |

_Learning-phase threshold: 50 events/week per ad set (Meta Business Help Center: About the learning phase)._