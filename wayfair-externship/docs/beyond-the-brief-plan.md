# Beyond the Brief: 7-Day Build Plan

Goal: show Wayfair how the guided agents could be trusted, used on demand and scaled across category teams, as a proof of concept on free tiers, mapped to Wayfair's production stack.

## Decisions
- Shared data store: **n8n Data Tables** (stands in for BigQuery).
- Team channel: **Slack** (Wayfair's internal messaging per public Slack case studies; confirm with the externship guide). Dhruv creates a free Slack workspace and app and enters the credentials himself.
- Work on **copies** (v2) of the Phase 3 and Phase 4 workflows; submitted workflows stay untouched.
- Models stay on free tiers (Mistral `ministral-14b-2512`); test tool calling before relying on it.
- Ask before activating any workflow (needed for Slack commands and the weekly schedule).

## Schedule (must-haves first)
| Day | Build | Demo check |
|---|---|---|
| 1 | Data layer: `competitor_listings` + `agent_runs` tables; Phase 3 v2 records listings and logs run health (flags "degraded" when a section is empty) | One v2 run gives 30 listing rows + 1 run row matching the report |
| 2 | AI Evidence Check sub-workflow: numbers vs sources, banned phrases, past dates, reused lines, plus an AI claim-support step; verdict pass / review / block. Wired into Phase 3 v2 and Phase 4 v2 | Re-check runs 79–82: fake report blocked, run 82 flagged for review |
| 3 | Slack app + `/rug-intel deep-dive <category> focus: <x>`: verify signature, ack in 3 s, run Phase 3 v2 as sub-workflow, post findings + trust verdict + report to the thread | Command in Slack returns a deep dive in about 4 min |
| 4 | `/rug-intel ask <question>`: Q&A agent with a tool that reads `competitor_listings`, cites rows, answer passes the Evidence Check. Same agent behind an n8n chat as fallback | Answer cites real rows; unsupported numbers flagged |
| 5 | Category config table (keys, competitors, vocabulary, brand rules); Phase 3/4 v2 read it | Same workflows run for a second category |
| 6 | Weekly scheduled run + change digest to Slack (price drops, new listings, rating moves) + dashboard v2 reading the tables (history, trust and run-health panels) | Digest posts "what changed"; dashboard shows history |
| 7 | Buffer, end-to-end run, backup demo recording, "Beyond the Brief" + production-architecture slides, updated Loom script | Final deck and demo |

If behind schedule, cut in this order: dashboard v2 history panel, weekly digest, category config.

## Production mapping (for the architecture slide)
| Prototype | Wayfair production equivalent |
|---|---|
| n8n Data Tables | BigQuery |
| Mistral / OpenRouter | Gemini on Vertex AI |
| HTML dashboard | Looker / Connected Sheets |
| Free Slack workspace | Wayfair Slack channels |
| Self-hosted n8n on EC2 | n8n on GKE behind Google SSO (later: Airflow + Vertex AI services) |
| Category config table | Same, owned by each category team |

Production also needs: per-team access control, real catalog/sales feeds instead of the sample API, a compliance review of competitor data collection, cost tracking, and human approval before external content ships.
