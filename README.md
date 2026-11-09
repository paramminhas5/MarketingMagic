# Marketing Magic

A marketing engine made of 18 standalone products. Each one does a single job
well. Together they research a market, decide the strategy, make the work,
check it, ship it, answer the leads and learn from the results, for any number
of clients.

Built on the research in [`playbooks/`](playbooks) (what demonstrably works in
2025-2026, with sources) and the design in [`docs/architecture.md`](docs/architecture.md).

## The products

| Product | Job | Default autonomy |
|---|---|---|
| [Intake](products/intake) | Fills a new client's profile from their site and code, so onboarding needs only a URL | A0 auto |
| [Auditor](products/auditor) | Readiness gate: checks the funnel for known leaks, locks paid spend and outbound until blockers pass, writes the fixes | A0 auto |
| [Planner](products/planner) | Honest budget maths: how many angles the money can test to a conclusion, and when paid can only amplify | A0 auto |
| [Scout](products/scout) | Market picture: competitors, audience language, search and AI-answer landscape | A0 auto |
| [Strategist](products/strategist) | Positioning, motivation matrix, offers, channel plan, tests | A2 approve |
| [Architect](products/architect) | Designs the client's machine: which products run, when, with what autonomy and caps | A2 approve |
| [Studio](products/studio) | Distinct paid-ad concepts across motivations, with copy, scripts and image-gen prompts | A1 capped |
| [Voice](products/voice) | Ghostwrites for named people in their own voice | A2 always |
| [Social](products/social) | Brand-channel plan: carousels for saves, Reels/TikTok for reach | A1 capped |
| [Search](products/search) | SEO + GEO: commercial queries, page briefs, AI-citation seeding briefs | A2 approve |
| [Pages](products/pages) | Message-matched landing pages with a required "how did you hear about us" field | A2 approve |
| [Media Buyer](products/media-buyer) | Plans paid campaigns (created paused), applies kill/scale rules daily | A1 capped |
| [Hunter](products/hunter) | Signal-based outbound segments and sequences for a human to edit | A2 always |
| [Lifecycle](products/lifecycle) | Welcome, cart, drop, post-event, nurture and win-back flows | A1 capped |
| [Lead Desk](products/lead-desk) | Codes, scores and routes every lead, drafts a fast human reply | A1 capped |
| [Gatekeeper](products/gatekeeper) | Checks everything before it ships: AI tells, duplicates, claims, policy, caps | A0 auto |
| [Analyst](products/analyst) | Weekly memo, kill/scale calls, learnings, briefs for the other products | A0 auto |
| [Proof](products/proof) | Weekly commitments vs delivered, leaks fixed, audience growth, benchmark gaps, where a human is the bottleneck | A0 auto |

A0 auto · A1 auto within caps · A2 a human approves · A3 a human does it.
Anything under a real person's name, any new spend and any new outbound
sequence always goes to a human.

## What the engine guarantees, and what it doesn't

Marketing isn't trading: most of what you do changes the outcome directly. The engine is built around that split ([docs/certainty.md](docs/certainty.md)):

- **Near-certain wins first.** The Auditor finds leaks (no tracking, no "how did you hear", slow replies, missing flows, broken promises) and **locks paid spend and cold email** until the blockers pass. Fixing leaks recovers demand you already have.
- **Honest testing.** The Planner says up front how many angles your budget can bring to a confident result (~30 results each) and switches to "amplify only" when it can't. Winners are called by Bayesian probability-of-best, never by a lucky week.
- **Promises on inputs, tracking on outcomes.** `machine.yaml` commitments (concepts, drafts, pages, leads answered in 10 min) are what the engine controls; Proof reports them weekly next to outcomes and research benchmarks.

## Clients

Each client is a folder in [`clients/`](clients): `client.yaml` (who they are),
`machine.yaml` (their machine), `voice/` (writing samples), `inputs/` (connector
research), `research/` (market brief + strategy), `out/` (everything produced).

```bash
mm clients                     # list
mm use cats-can-dance          # switch
mm status                      # what exists, what's waiting
```

### Add a new client (the engine builds their machine)

```bash
mm new acme --url https://acme.com
mm onboard --objective "200 orders/month" --monthly 100000 --daily 4000
```

`onboard` runs Intake → Scout → Strategist → Architect → Auditor → Planner. Intake
reads the site (and code, if `audit.codebase` is set) and fills `client.yaml`;
anything it can't establish lands in `out/intake-questions.md`. You get a market
brief, a strategy, a `machine.yaml` with schedules, caps and weekly commitments,
a readiness audit with an opening playbook of fixes, and a test plan. It resumes
from wherever it stopped.

### Run everything on autopilot

```bash
mm autopilot     # prints the ONE scheduled-task prompt
mm tick --all    # what that task runs: every product that's due, for every client
```

The tick reads each client's `machine.yaml` schedules and the run log. Content
production waits for strategy and machine approval; paid spend waits for the
readiness gate; analysis skips weeks with no data. Adding a client needs no new task.

## Running products

```bash
mm run studio --client cats-can-dance --input '{"count":15,"campaign":"dec-night"}'
mm campaign clients/cats-can-dance/briefs/next-event.yaml   # every enabled production product + Gatekeeper
mm cycle --target 250                                         # Lead Desk -> Gatekeeper -> Analyst
mm readiness                                                  # is spend/outbound unlocked, and why not
mm approvals                                                  # what needs you
mm approve <id> --final edited.txt                            # your edit trains future drafts
```

Each product also runs alone: `npm start -w @mm/scout -- --client iterate`.

### Three ways to run, same code

1. **Headless** with `ANTHROPIC_API_KEY`: products call Claude directly (cron, server).
2. **In a Claude session with connectors** (Claude Code or claude.ai with this repo):
   the session gathers evidence with Meta Ads, Ahrefs, Semrush, Clay, Apollo,
   Magnific, Canva and so on, following each product's `SKILL.md`, then runs the product.
3. **No key at all:** the thinking step is saved to `clients/<slug>/out/pending/`.
   A Claude session answers it and `mm submit <pending> <answer.json>` finishes the run.

Every product has the same shape: `gather` (files, connector exports, APIs) →
`think` (one typed Claude call) → `finish` (validate, store, act).

## Data

`MM_STORE=file` (default) keeps each client's records in `clients/<slug>/data/`.
`MM_STORE=supabase` writes the same records to Postgres: apply
[`supabase/migrations`](supabase/migrations) and deploy
[`supabase/functions/lead-intake`](supabase/functions/lead-intake), which the
landing pages post to.

## Setup

```bash
npm install
cp .env.example .env      # optional keys
npm run typecheck && npm test
npx mm help
```

## Layout

```
packages/core     contracts (zod), workspaces, store, LLM runner, rules, API adapters
products/*        the 14 products (each: src/index.ts, SKILL.md, README.md)
engine            mm CLI, Conductor (onboard / campaign / cycle), skill generator
clients/*         one workspace per client (_template for new ones)
playbooks         Phase 1 research the products cite
supabase          schema + lead-intake edge function
.claude/skills    generated skills so Claude sessions can run every product
```
