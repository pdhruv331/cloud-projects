# Wayfair Externship: n8n AI agents (Rugs category)

Full context: @docs/project-brief.md. Read it before any Phase 3+ work.

## Current state
- Phases 1–2 are done: workflow `mhvhOPSqwWtvrrm0` ("My workflow"). Reference only, **never edit it**.
- Phase 3 is done: workflow `WJQ0sTQIUub8sRlW` ("Phase 3 - Competitor Monitoring Report"), built to match the Wayfair guide's screenshots. Export in `workflows/phase3-competitor-report.json`.
- Phase 4 is done: workflow `iC3xoxy9SsgsdK9m` ("Project 4 - Content Strategy Generator v3 (Premium)"), a form taking the P2 and P3 HTML reports. Export in `workflows/phase4-content-strategy.json`. Enhanced with a Wayfair voice system message, evidence rules, audience/season inputs and an automatic Quality Check. Its Mistral node was disabled on Oct 7.
- Phase 5 is done: workflow `jjtCT9yeRxpTteRw` (Dashboard Builder). Final deck: `Wayfair_Final_Presentation_Dhruv_Patel_v2.pptx` (v1 kept).
- Beyond the Brief ("Rug Intel", plan in docs/beyond-the-brief-plan.md) is built on copies: Phase 3 v2 `AjaQorgLqUA6y4fu`, Phase 4 v4 `68DPzuZsMfZeG8vj`, plus AI Evidence Check `GhtKfO6hrdLRzEjS`, Rug Intel Ask `AI5A418ZAjCqiyBL`, Slack Command `NoT9yIia6FZSyo8L`, Weekly Digest `hjRvI20qZL1ExNyM`, Web (dashboard/report) `UwxC9Vj29erYyeQQ`, Error Handler `VpfgQUCagSok4d7i`. Sources and change ops in workflows/beyond-the-brief/. Data tables: competitor_listings, agent_runs, evidence_checks, reports, category_config, listing_snapshots, weekly_digests. Slack setup: docs/slack-setup.md. Never commit the Slack signing secret (Sign Request node).
- Dhruv follows the guide's screenshots and pastes the guide's code himself. Build nodes with the guide's exact names so pasted `$('...')` references work, then check his pastes for wrong node/field names.

## Rules
- Explain planned workflow changes and get a yes **before** creating, editing, saving, running, or publishing anything in n8n.
- Free tiers only. Dhruv enters all API keys and secrets himself.
- Don't touch the n8n server (EC2/Docker/Caddy) config, restarts, or upgrades without discussing it first.
- Agents: OpenAI Chat Model node + "Mistral (OpenAI-compatible)" credential, `ministral-14b-2512`, `responsesApiEnabled: false`, with a Wait of at least 2s between Mistral calls.
- No invented stats. Cite real counts ("6 of 10 listings"). Guard against empty data so the run fails loudly.
- HTML output: no Markdown artifacts, no italics, `<strong>` only for short labels, hashtags as pill tags.
- Use the `mcp__n8n__*` tools to inspect and build workflows. Follow the n8n MCP instructions (SDK reference → best practices → search_nodes → get_node_types → validate).
