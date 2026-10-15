# Beyond the Brief: 3-minute demo script (Rug Intel)

**Before you present:** run one deep dive and one digest the same day so the dashboard is fresh. Keep the dashboard, Slack and one stored report open in tabs. If Slack or the server misbehaves, show the recorded backup and the stored report link instead.

## 0:00 – 0:20 · The problem
"The five guided agents produce good reports, but a category manager can't tell which numbers to trust, has to ask me to run them, and every category needs its own copy. Rug Intel fixes those three things."

## 0:20 – 1:10 · Trust: the AI Evidence Check
Open a stored report (`/webhook/rug-intel/report?run=92`) and point at the Trust box.
"Every output goes through one shared check before anyone sees it. It traces every number back to the listing data, flags non-answers, banned phrases and past dates, and asks a second model to re-check the factual sentences.
Here it caught the Comparison section writing Wayfair's average as $187.50 when the listings say $202.58. On another run, a free model returned only the words 'User Safety: safe' for a whole section; the check blocked that report.
Design choice: only rule-based checks can block. The AI second opinion can send a report to review, never veto it alone."

## 1:10 – 2:00 · On demand: Slack
In #rug-intel:
- `/rug-intel ask which Walmart area rugs under $50 rate best?` → answer in seconds, every listing cited by ID (AR-M15…), with its evidence verdict.
- `/rug-intel status` → the last runs and their trust verdicts.
- Mention `/rug-intel deep-dive outdoor rug focus: weather resistant` runs the full Phase 3 agent and posts the summary plus report link in about 7 minutes (show a finished one).

## 2:00 – 2:40 · What changed + one view
Show the Monday digest message, then the dashboard.
"Every Monday it snapshots the full listing pool and compares products one by one: two Amazon price drops, a Wayfair price rise, two new Walmart listings. The numbers come from code; the AI only writes the Act / Watch bullets, and those are checked too.
To be transparent: the sample API has fixed prices, so this demo week is compared against a simulated baseline, and the message says so."

## 2:40 – 3:00 · Scale and production
Show the Production Architecture slide.
"A new category is one row in a config table: Outdoor Rug went live with no new workflow. At Wayfair the same design maps to BigQuery, Gemini on Vertex AI, Looker and Slack, behind Google SSO. The next step I'd propose is a four-week pilot with one category team."

## Numbers to have ready (from Oct 15 test runs)
- Run 92 (Area Rug): 6/6 sections, 45 of 52 numbers traceable, verdict BLOCK under the first rule set (now REVIEW under "only rules can block").
- Run 90: Amazon section was "User Safety: safe" → caught as a non-answer.
- Run 99 (Outdoor Rug, second category): 6/6 sections, REVIEW, 46 of 63 numbers traceable.
- Q&A: about 6 s, 6 listings cited, no invented IDs.
- Digest: 13 s for two categories.
