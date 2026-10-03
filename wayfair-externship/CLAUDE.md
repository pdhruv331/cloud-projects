# Wayfair Externship: n8n AI agents (Rugs category)

Full context: @docs/project-brief.md. Read it before any Phase 3+ work.

## Current state
- Phases 1–2 are done: workflow `mhvhOPSqwWtvrrm0` ("My workflow"). Reference only, **never edit it**.
- Phase 3 (Monitor Competitors) is next, as a new separate workflow. Wait for Dhruv's Phase 3 materials before designing the pipeline.

## Rules
- Explain planned workflow changes and get a yes **before** creating, editing, saving, running, or publishing anything in n8n.
- Free tiers only. Dhruv enters all API keys and secrets himself.
- Don't touch the n8n server (EC2/Docker/Caddy) config, restarts, or upgrades without discussing it first.
- Agents: OpenAI Chat Model node + "Mistral (OpenAI-compatible)" credential, `ministral-14b-2512`, `responsesApiEnabled: false`, with a Wait of at least 2s between Mistral calls.
- No invented stats. Cite real counts ("6 of 10 listings"). Guard against empty data so the run fails loudly.
- HTML output: no Markdown artifacts, no italics, `<strong>` only for short labels, hashtags as pill tags.
- Use the `mcp__n8n__*` tools to inspect and build workflows. Follow the n8n MCP instructions (SDK reference → best practices → search_nodes → get_node_types → validate).
