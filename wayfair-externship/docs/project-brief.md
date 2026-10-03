# Handoff Brief: Wayfair Externship, Phase 3 Onward

_Owner: Dhruv. Prepared Sep 26, 2026. Phases 1–2 are finished and won't be edited further._

## 1. Project context
- **Program:** Wayfair AI Agent Engineering Externship on Extern.com. 8 weeks, with live sessions starting Aug 24, 2026. Externship guide: Maria Nino-Suastegui (Wayfair Supplier Inventory Management team).
- **Role framing:** Dhruv acts as an AI Agent Developer at Wayfair, building agents that surface rug trends, competitor moves, and marketing content ideas **before trends reach the homepage**.
- **Stack:** n8n (the program's intended model is Gemini; Dhruv uses Mistral and OpenRouter instead, see §4). Category focus is **Rugs**, with keys `area_rug`, `outdoor_rug`, `hallway_runner`, `shag_rug`.
- **Final deliverable:** a live, auto-updating **Google Sheets dashboard** that surfaces trends, benchmarks, and content suggestions Wayfair's category team can actually use.
- **All 5 phases** (the week-by-week split hasn't been shared):

| # | Phase | Scope | Status |
|---|---|---|---|
| 1 | Moodboard Agent | Turn style prompts into curated visual outputs (AI images) | ✅ Done |
| 2 | Discover Market Trends | Collect and analyze product data, blogs, and social media to find design trends; produce a trend report | ✅ Done |
| 3 | Monitor Competitors | Track competitor product launches, pricing updates, and marketing campaigns | ▶️ Starting now, as a **new, separate workflow** |
| 4 | Generate AI Insights | Turn trend and competitor signals into summaries, blog ideas, and campaign captions | Not started |
| 5 | Build the Dashboard | Combine datasets and insights into a live, auto-updating Google Sheets tool for managers | Not started |

- The externship provides code for each phase: agent system prompts, parsing/standardizing/normalizing code, and report generation. Dhruv may modify it freely as long as the deliverable is met, and he wants to improve on it and make it his own.
- Dhruv will share the Phase 3 materials (task spec, provided code, API endpoints) as he works through them. **Don't design the full pipeline before seeing them.**

## 1a. Recap of Phases 1–2 (finished, don't edit)
**What it is:** one chat-triggered n8n workflow (`mhvhOPSqwWtvrrm0`, still named "My workflow," about 73 nodes). Dhruv types a category like `area rugs` (optionally `focus: jute` on a second line), and about 10 minutes later it produces a downloadable **HTML trend report** with AI moodboard images.

**How it works:**
1. **Collect data** from the externship's sample API: 10 Amazon products, plus Instagram posts, Pinterest pins, blog articles, and market data for the category. A typical run pulled 10 products, 8 Instagram, 5 Pinterest, 3 blogs, and 1 market data record.
2. **Clean the products** with agents: one removes off-category items, another standardizes attributes (material, size, color, pattern, price).
3. **Find trends:** an agent identifies **2–3 style micro-segments**, weighting visual signals (e.g. "Desert Modern Organic," "Artisanal Boho Global Kilim").
4. **Moodboards (Phase 1):** an agent writes an image prompt per segment, and FLUX.1-schnell generates one image each, via the Hugging Face router to fal.ai.
5. **Write the report:** eight agents each write one section in HTML, and code assembles, validates, and cleans the final page.

**Report sections** (modeled on Wayfair's sample report at `https://smitabudhiaextern.github.io/extern-html-pages/area_rug_trend_report_2026-06-02.html`): Executive Summary, Scope of Research, Market Research, Category Deep Dive (micro-segments + sizing guide), Product Attribute Analysis, Visual Trend Analysis (moodboards + social posts), Trend Risks, Demand Signals & Recommendations.

**Models:** the 4 data/trend agents run on OpenRouter free (Dhruv chose to keep this). The 8 report-writing agents run on Mistral `ministral-14b-2512`.

**What was improved over the provided code** (useful as a checklist for Phase 3's provided code):
- **Three social fetch nodes returned nothing** because of an extra `=` in the category value, so the original report was built on Amazon and Instagram data only.
- **Three report agents had no AI model connected**, and **one had no system prompt** (it wrote a consumer blog post in Markdown).
- **A whole section was silently missing** because the assembly code referenced a node name that didn't exist, and **images never reached the report** because of a capitalization mismatch in another node name.
- **Only 1 of 3 moodboards was generated** because the code used `$input.first()`.
- **Added a cleanup layer** in the assembly step that strips AI chatter, converts leftover Markdown to HTML, removes italics, and styles hashtags. Also added prompt rules against invented statistics and outdated years.

**Result:** the report now runs end to end with all sections and all images, and it compares well with Wayfair's sample. **Its main remaining weakness,** shared with the sample, is AI-invented statistics ("80% of sales" from 10 listings). That's the key lesson to carry into Phases 3–5.

**Where Phase 2's output fits later:** its micro-segments, attribute counts, and social signals are the "trends" half of the Phase 5 dashboard. Phase 3 supplies the competitor half, and Phase 4 turns both into content ideas.

## 2. Dhruv's priorities and working agreements
- **Priority: business value for Wayfair's Rugs category team.** Frame outputs around decisions a category manager makes: competitor price moves, assortment gaps, launches to respond to, and what to act on vs. watch.
- **Stay on free tiers.** Don't enable paid plans. Mistral has Pay-As-You-Go off; Hugging Face is on the free tier.
- **Explain planned changes and get a yes before editing, saving, or running workflows.** Dhruv enters all API keys and secrets himself.
- Dhruv usually runs workflows himself and reports what happened. The assistant then inspects the execution.
- **Report formatting preferences:** HTML only, with no Markdown artifacts (`**`, `#` headings, `-` lists, code fences), **no italics**, `<strong>` only for short labels, and hashtags shown as styled pill tags.

## 3. Environment
- **n8n** self-hosted at `https://n8n.builtbydhruv.com` (AWS EC2, Docker, Caddy, Route 53, nightly S3 backup). Dhruv doesn't fully understand the server setup yet, so **don't touch server config, restarts, or upgrades** without discussing it.
- **Data source:** the externship's sample API (plain HTTP, host `34.196.186.128:8000`). Phase 3 competitor endpoints are probably on the same host; confirm from the materials.
- **Existing workflow** (reference only, don't edit): `mhvhOPSqwWtvrrm0` ("My workflow"), the Phase 1–2 trend report. Its **Assemble HTML Report** node has a reusable cleanup layer (it strips chatter outside `<section>`, converts Markdown to HTML, removes italics, styles hashtags, and replaces category slugs). Copy it if Phase 3 produces HTML.

**Credentials (names only):**
| Name | Type | Use |
|---|---|---|
| **Mistral (OpenAI-compatible)** | OpenAI API type, base URL `https://api.mistral.ai/v1` | **Default for new agents** |
| OpenRouter account | OpenRouter | `openrouter/free` (random model per call, inconsistent) |
| Mistral Cloud account | Mistral Cloud | **Don't use** (the native node is broken) |
| Google Gemini(PaLM) Api account | Gemini | Prepaid credits depleted |
| Hugging Face token | Hardcoded header in the Phase 2 image node | Image generation; free credit is almost used up until Oct 1 |

A Google Sheets credential will be needed for Phase 5 and doesn't exist yet.

## 4. Model setup (use this for Phase 3 agents)
- Use the **OpenAI Chat Model node** (v1.3) with the **"Mistral (OpenAI-compatible)"** credential and model **`ministral-14b-2512`** (or `ministral-8b-2512`). Set **`responsesApiEnabled` to false**.
- **Rate limit:** 0.5 requests/second, so put a Wait of at least 2 seconds (5 seconds used so far) between consecutive Mistral agents.
- **Blocked on this free account:** `mistral-medium-latest` and `mistral-small-2603` (return 429 "no body" even on tiny requests), and `mistral-large-2512` (403, needs the paid Scale plan). The Mistral Limits page lists models the plan **can't** actually call, so test before relying on it.
- **Ask Dhruv** whether any Phase 3 agents should use OpenRouter free (he kept it for some Phase 2 agents), but default to Mistral.
- Ministral tends to add Markdown, italics, preambles, and code fences even when told not to. Put the strict formatting rule in prompts **and** clean the output in code.

## 5. Phase 3 plan
**Steps**
1. Review the provided Phase 3 materials and check them for these bug types, all found in Phase 2's provided code:
   - Extra `=` in expression values (e.g. `=={{ … }}` sent `=area_rug`, and the API returned nothing)
   - `$('Node Name')` references that don't match actual node names. They're **case-sensitive** and fail silently.
   - `$input.first()` where all items should be processed
   - Agents with **no system prompt** or **no language model connected**
2. Build the new workflow with Mistral agents (§4).
3. Design the output as **flat, consistent records** that can be appended to Google Sheets in Phase 5, for example: competitor, product, category key, date seen, price, previous price, change, event type (launch / price change / campaign), source ID or URL.

**Proposed acceptance criteria** (confirm against the official Phase 3 brief):
- Runs end to end on free tiers with no manual fixes.
- Detects competitor launches, price changes, and campaigns, at least for Area Rug and ideally all 4 category keys.
- Every finding cites its data (competitor, product, before/after price). **No invented percentages or statistics.**
- Fails loudly on empty or unparseable data (e.g. stops with an error when zero records come through) instead of producing an empty or made-up output.
- Output is structured and stable enough to feed the Phase 5 dashboard.
- Any HTML output follows the formatting preferences in §2.

**Open questions for Dhruv**
- The Phase 3 spec: which competitors, which endpoints, and what output format is expected?
- Scheduled trigger or chat trigger?
- Its own HTML report, or only structured data for the dashboard?
- The week-by-week timeline and Phase 3 due date?

## 6. Lessons that carry forward
- **Evidence over invented numbers.** The data has no sales, returns, or conversion figures. Agents will still turn "8 of 10 listings" into "80% of sales," and the Wayfair sample report makes up statistics too. Require real counts and precise wording ("6 of 10 competitor listings dropped price"). Doing this well is Dhruv's clearest way to stand out.
- **Watch for silent failures.** In Phase 2, an unparseable OpenRouter response passed an empty product list forward, and later agents wrote a report anyway. Add guards so empty data stops the run with a clear message.
- **Plan for history in Phase 5.** Storing each run's results enables trend and competitor momentum (new / rising / fading, price trends over time), which a category manager will want.

## 7. n8n and browser gotchas
> Mostly superseded in Claude Code: the n8n MCP server is connected, so read, edit, and inspect workflows and executions through `mcp__n8n__*` tools instead of the browser REST API. The node-level gotchas below still apply.

- **Internal REST API from page JavaScript** in the n8n tab needs the `browser-id` header (`localStorage['n8n-browserId']`) plus the session cookie, otherwise it returns 401. The assistant can't log in for Dhruv.
  - Useful endpoints: `GET/PATCH /rest/workflows/<id>` (PATCH needs `name, nodes, connections, settings, versionId, pinData, meta, tags` with the current `versionId`), `POST /rest/workflows` to create, `POST /rest/workflows/<id>/archive`, `GET /rest/executions?filter={"workflowId":…}`, `GET /rest/executions/<id>`.
  - Execution data is in **"flatted" format**: `JSON.parse`, then resolve string indices recursively from index 0.
- **After saving through the API (or MCP), Dhruv's open editor tab is stale.** He must reload before running or saving, or he may overwrite the changes.
- **Renaming a node breaks `$('Old Name')` references** in Code nodes and expressions without any error.
- **Rerun from a failure:** Executions → open the run → **Debug in editor** → run the last node. Unpin the data afterward.
- **Test model access with a tiny temporary workflow** (manual trigger + HTTP Request with `predefinedCredentialType: openAiApi` posting to `/v1/chat/completions`, `neverError: true`) before switching models. Archive it afterward.
- **Claude in Chrome:** only tabs in the assistant's own tab group are usable. `file://` pages can't be read, so get reports from execution data. Downloads started by a script may be blocked; an on-page button that Dhruv clicks works.
- The browser tool may block returning some code text. Replacing `=`, `&`, and `?` in the returned string works around it.

## 8. Verified in Claude Code (Sep 26, 2026)
Checked via the n8n MCP server:
- Workflows: only `mhvhOPSqwWtvrrm0` ("My workflow"), available in MCP, inactive (chat-triggered). No Phase 3 workflow exists yet.
- Credential IDs: Mistral (OpenAI-compatible) `S1gjPjQ4bvcDXqeN` · OpenRouter account `HS2qIFvFSIvBbfw7` · Mistral Cloud account `53jqew9g8xDaqb5p` · Google Gemini(PaLM) `z4Im4R7pACHe0gOZ`.
- New workflows must have "Available in MCP" enabled in n8n for Claude Code to see them.
