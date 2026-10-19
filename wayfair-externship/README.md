# Wayfair Rugs Market Intelligence: AI Agent System

An n8n multi-agent system built during the **Wayfair AI Agent Engineering Externship** (Extern, Aug–Oct 2026) for Wayfair's Rugs category. It discovers rug trends, benchmarks Wayfair against Amazon and Walmart, turns both into an on-brand content plan, and pulls everything into one dashboard.

On top of the five externship phases I built **Rug Intel**, an extension that makes the agents usable day to day:
- a Slack app
- an evidence check on every AI output
- a weekly change digest
- a live dashboard

## What it does

### The externship build (Phases 1–5)

| Phase | Agent | Input → Output |
|---|---|---|
| 1 | **Moodboard Generator** | Trend micro-segment → AI-generated room moodboards (FLUX.1-schnell) |
| 2 | **Trend Discovery** | Rug category → trend report with 2–3 style micro-segments and the evidence behind each (Amazon listings, Instagram, Pinterest, design blogs) |
| 3 | **Competitor Monitoring** | Rug category → Wayfair vs. Amazon vs. Walmart benchmark on price, assortment, ratings and discounts |
| 4 | **AI Insights & Content** | Trend + competitor reports, audience, season → content plan (blog ideas, captions, campaigns, emails, competitive angles) in Wayfair's voice |
| 5 | **Market Intelligence Dashboard** | Both reports → one HTML dashboard (code parser, no AI, so every figure is copied exactly) |

### Rug Intel (beyond the externship)

| Part | What it does |
|---|---|
| **AI Evidence Check** | A shared sub-workflow every report goes through. It traces each number back to the collected listings, flags non-answers, banned phrases and copied example lines, adds an AI second opinion on claims, and returns **PASS**, **REVIEW** or **BLOCK**. Only rule-based checks can block; the AI only advises. |
| **Slack integration** | `/rug-intel deep-dive <category> focus: <x>`, `/rug-intel ask <question>` and `/rug-intel status`. Verifies Slack's request signature, replies within Slack's 3-second limit, then posts the checked answer to the channel. |
| **Ask agent** | Answers questions from the stored listings and cites listing IDs. The answer goes through the Evidence Check. |
| **Weekly digest** | Compares this week's listings with last week's snapshot: price moves, new and removed products, rating changes. |
| **Live dashboard** | Reads the shared tables directly: where Wayfair sits per category, what changed this week, run health and every evidence verdict. |
| **Category config** | Each category is one row (search terms, competitors, owner team, price-move threshold, notes). Adding Outdoor Rug took one row. |
| **Error handler** | Attached to all production workflows; alerts on any crash so nothing fails silently. |

## Architecture

```mermaid
flowchart LR
  subgraph Triggers
    S["Slack /rug-intel"]
    M["Monday schedule"]
    F["Chat + form inputs"]
  end
  subgraph Agents
    C["Competitor Agent v2"]
    P["Content Agent v4"]
    A["Ask"]
    D["Weekly Digest"]
  end
  subgraph Shared["Shared layer"]
    E["AI Evidence Check<br/>PASS / REVIEW / BLOCK"]
    T[("7 n8n data tables")]
  end
  subgraph Outputs
    R["Slack replies<br/>+ trust verdict"]
    W["Live dashboard<br/>+ report pages"]
    MP["Monday post"]
  end
  S --> C & A
  M --> D
  F --> C & P
  C & P & A & D --> E
  C & P & A & D <--> T
  E --> R & W & MP
```

**Data tables:**
- `competitor_listings`
- `listing_snapshots`
- `agent_runs` (run log)
- `evidence_checks`
- `reports`
- `category_config`
- `weekly_digests`

## Highlights

- **Caught a wrong number before anyone saw it.** In one run the AI reported Wayfair's average price as $187.50. The Evidence Check traced it to the source data, where it was actually $202.58.
- **Blocked a non-answer.** A report section that only said "User Safety: safe" was blocked instead of being shipped.
- **Content checks.** In a content-plan run, 26 of 27 numbers traced back to the data. The check flagged a misused "80%" claim, a banned phrase used twice and four lines copied from the prompt examples.
- **Fixed bugs in the provided starter code.**
  - Three social fetch nodes returned nothing because of an extra `=`.
  - Several report agents had no model connected.
  - A whole section was dropped because the code referenced the wrong node name.
  - The dashboard parser was losing the attribute tables and discount tiers.

## Repository layout

```
wayfair-externship/
├── docs/
│   ├── project-brief.md                  # project context and phase-by-phase notes
│   ├── beyond-the-brief-plan.md          # Rug Intel build plan and production mapping
│   ├── beyond-the-brief-demo-script.md   # live demo script
│   └── slack-setup.md                    # Slack app manifest and setup steps
├── workflows/
│   ├── exports-2026-10-16/               # final n8n workflow exports (secrets removed)
│   ├── beyond-the-brief/                 # Rug Intel workflow sources (n8n SDK) and code nodes (src/)
│   └── phase*.json                       # earlier snapshots of each phase
├── reports/                              # sample outputs: trend, competitor, content reports, dashboard
├── Wayfair_Final_Presentation_*.pptx     # presentation decks
└── loom-teleprompter.html                # teleprompter for the walkthrough video
```

## Running it yourself

1. **n8n:** self-host n8n (I used Docker on a small cloud VM) or use n8n Cloud.
2. **Import:** load the JSON files from `workflows/exports-2026-10-16/` into n8n.
3. **Credentials:** add your own in n8n. The exports contain placeholders only.
   - An OpenAI-compatible model. I used Mistral `ministral-14b-2512` on the free tier, plus OpenRouter free models for a few data agents.
   - A Hugging Face token for FLUX.1-schnell.
   - Slack, for the Rug Intel commands.
4. **Data tables:** create the seven tables listed above and add your categories to `category_config`.
5. **Slack:** follow `docs/slack-setup.md` and paste your app's signing secret into the **Sign Request** node. Don't commit it.
6. **Data source:** the externship's sample API only serves rug categories. For another category, point the fetch steps at a feed that returns the same fields (title, price, rating, reviews, retailer) and adjust the rug-specific prompt wording.

## Tech stack

- **Workflows:** n8n (self-hosted), with AI Agent nodes, Code nodes (JavaScript), Data Tables and webhooks.
- **Models:** Mistral `ministral-14b-2512`, OpenRouter free models, FLUX.1-schnell via Hugging Face. All on free tiers.
- **Integrations:** Slack (slash commands, signed requests, `response_url`).
- **Production mapping** (how this would run at Wayfair):

  | Prototype | Wayfair equivalent |
  |---|---|
  | Data tables | BigQuery |
  | Mistral / OpenRouter | Gemini on Vertex AI |
  | HTML dashboard | Looker |
  | Slack | Slack behind Google SSO |

## What I learned

1. **Trust is the real product.** An agent is only useful if it tells you which parts of its answer to double-check.
2. **Rules decide, AI advises.** When the AI checker started blocking sound sections, I limited blocking to rule-based checks.
3. **Quiet failures are the dangerous ones.** A run can finish "successfully" with a section missing, so every run now logs what it actually produced.

## What's next

- Match rising trends to the suppliers who make them, so sourcing can act before demand peaks.
- Feed checked demand and competitor-price signals into order planning.
- Bring the Trend Discovery agent into Rug Intel: weekly runs, evidence checks, and segments tracked as rising or fading.

## Notes

- All data comes from the externship's sample API and small samples (about 10 listings per retailer per run), so counts are directional, not market share.
- Moodboards are AI-generated concept visuals, not Wayfair products.
- Built by **Dhruv Patel** as part of the Extern × Wayfair AI Agent Engineering Externship.
