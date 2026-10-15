import { workflow, node, trigger, sticky, languageModel, newCredential, expr } from '@n8n/workflow-sdk';

const everyMonday = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: { name: 'Every Monday 8am', parameters: { rule: { interval: [{ field: 'weeks', weeksInterval: 1, triggerAtDay: [1], triggerAtHour: 8, triggerAtMinute: 0 }] } }, position: [0, 0] },
  output: [{}]
});
const digestCategories = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Digest Categories', parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '4KeWqQ88qv3lJNV5', cachedResultName: 'category_config' }, returnAll: true }, position: [220, 0] },
  output: [{ category_key: 'area_rug', display_name: 'Area Rug', weekly_digest: true, active: true, price_move_pct: 5 }]
});
const takeSnapshot = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Take Snapshot', parameters: { jsCode: "// Take Snapshot: record the full listing pool (not a 10-item sample) for every category with\n// weekly_digest = true, so next week can be compared product by product.\nconst cats = $input.all().map(i => i.json).filter(c => c.category_key && c.active !== false && c.weekly_digest === true);\nif (!cats.length) throw new Error('No categories have weekly_digest = true in category_config, so there is nothing to snapshot.');\n\nconst snapshotId = 'snap-' + $execution.id;\nconst snapshotDate = new Date().toISOString();\nconst num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\\d+(?:\\.\\d+)?/); return m ? parseFloat(m[0]) : null; };\nconst rows = [];\nconst warnings = [];\nfor (const cat of cats) {\n  for (const retailer of ['wayfair', 'amazon', 'walmart']) {\n    try {\n      const res = await this.helpers.httpRequest({\n        method: 'GET',\n        url: `http://34.196.186.128:8000/api/products/${retailer}`,\n        qs: { category: cat.category_key, limit: 50 },\n        json: true,\n        timeout: 30000\n      });\n      for (const p of res.products || []) {\n        rows.push({ json: {\n          snapshot_id: snapshotId, snapshot_date: snapshotDate, category_key: cat.category_key,\n          retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1),\n          product_name: String(p.name || '').slice(0, 300), product_url: p.url || '',\n          price: num(p.price), rating: num(p.rating), review_count: num(p.review_count), simulated: false\n        } });\n      }\n    } catch (e) {\n      warnings.push(`${cat.display_name} / ${retailer}: ${e.message}`);\n    }\n  }\n}\nif (!rows.length) throw new Error('The product API returned no listings for any digest category. ' + warnings.join('; '));\nrows[0].json._warnings = warnings.join('; ');\nreturn rows;\n" }, position: [440, 0] },
  output: [{ snapshot_id: 'snap-1', snapshot_date: '2026-10-15T12:00:00Z', category_key: 'area_rug', retailer: 'Wayfair', product_url: 'https://x', price: 100 }]
});
const cleanSnapshot = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Clean Snapshot Rows', parameters: { jsCode: "// Clean Rows: drop helper fields (_warnings, _edits) before saving.\nreturn $input.all().map(i => { const { _warnings, _edits, ...row } = i.json; return { json: row }; });\n" }, position: [660, 0] },
  output: [{ snapshot_id: 'snap-1' }]
});
const saveSnapshot = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Snapshot', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'UpvsZllfjXQmaKh1', cachedResultName: 'listing_snapshots' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [880, 0] },
  output: [{ id: 1 }]
});
const snapshotHistory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Snapshot History', executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'UpvsZllfjXQmaKh1', cachedResultName: 'listing_snapshots' }, returnAll: true }, position: [1100, 0] },
  output: [{ snapshot_id: 'snap-1' }]
});
const compareWeeks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Compare Weeks', parameters: { jsCode: "// Compare Weeks: product-by-product changes between this snapshot and the previous one\n// for each digest category. Thresholds come from category_config (price_move_pct).\nconst snapshotId = $('Take Snapshot').first().json.snapshot_id;\nconst cats = $('Digest Categories').all().map(i => i.json).filter(c => c.category_key && c.active !== false && c.weekly_digest === true);\nconst history = $input.all().map(i => i.json).filter(r => r && r.snapshot_id);\nconst money = n => '$' + Number(n).toFixed(2);\nconst round1 = n => Math.round(n * 10) / 10;\n\nconst categories = [];\nconst factLines = [];\nfor (const cat of cats) {\n  const rows = history.filter(r => r.category_key === cat.category_key);\n  const cur = rows.filter(r => r.snapshot_id === snapshotId);\n  const prevDates = {};\n  for (const r of rows) if (r.snapshot_id !== snapshotId) prevDates[r.snapshot_id] = r.snapshot_date;\n  const baselineId = Object.keys(prevDates).sort((a, b) => new Date(prevDates[b]) - new Date(prevDates[a]))[0];\n  const prev = rows.filter(r => r.snapshot_id === baselineId);\n  const simulated = prev.some(r => r.simulated === true);\n  const key = r => r.retailer + '|' + r.product_url;\n  const prevMap = Object.fromEntries(prev.map(r => [key(r), r]));\n  const curMap = Object.fromEntries(cur.map(r => [key(r), r]));\n  const threshold = Number(cat.price_move_pct || 5);\n\n  const priceMoves = [];\n  const ratingMoves = [];\n  for (const [k, c] of Object.entries(curMap)) {\n    const p = prevMap[k];\n    if (!p) continue;\n    if (p.price && c.price && p.price !== c.price) {\n      const pct = (c.price - p.price) / p.price * 100;\n      if (Math.abs(pct) >= threshold) priceMoves.push({ retailer: c.retailer, name: c.product_name, url: c.product_url, old: p.price, now: c.price, pct: round1(pct) });\n    }\n    if (p.rating && c.rating && Math.abs(c.rating - p.rating) >= 0.2) ratingMoves.push({ retailer: c.retailer, name: c.product_name, old: p.rating, now: c.rating });\n  }\n  const newListings = baselineId ? cur.filter(r => !prevMap[key(r)]).map(r => ({ retailer: r.retailer, name: r.product_name, url: r.product_url, price: r.price })) : [];\n  const removed = baselineId ? prev.filter(r => !curMap[key(r)]).map(r => ({ retailer: r.retailer, name: r.product_name, price: r.price })) : [];\n\n  const avg = (list, retailer) => { const p = list.filter(r => r.retailer === retailer && r.price).map(r => r.price); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 100) / 100 : null; };\n  const avgPrices = {};\n  for (const r of ['Wayfair', 'Amazon', 'Walmart']) avgPrices[r] = { previous: avg(prev, r), current: avg(cur, r), listings: cur.filter(x => x.retailer === r).length };\n\n  const drops = priceMoves.filter(m => m.pct < 0).sort((a, b) => a.pct - b.pct);\n  const rises = priceMoves.filter(m => m.pct > 0).sort((a, b) => b.pct - a.pct);\n  const c = {\n    category_key: cat.category_key, display_name: cat.display_name, owner_team: cat.owner_team || '',\n    baseline_id: baselineId || '', baseline_date: prevDates[baselineId] || '', baseline_simulated: simulated,\n    threshold, drops, rises, new_listings: newListings, removed, rating_moves: ratingMoves, avg_prices: avgPrices,\n    has_changes: !!(priceMoves.length || newListings.length || removed.length || ratingMoves.length)\n  };\n  categories.push(c);\n\n  factLines.push(`CATEGORY: ${cat.display_name}` + (baselineId ? ` (compared with snapshot of ${String(c.baseline_date).slice(0, 10)}${simulated ? ', a SIMULATED baseline' : ''})` : ' (first snapshot, no baseline yet)'));\n  for (const [r, a] of Object.entries(avgPrices)) factLines.push(`- ${r}: ${a.listings} listings, average price ${a.current !== null ? money(a.current) : 'n/a'}${a.previous !== null ? ' (was ' + money(a.previous) + ')' : ''}`);\n  for (const m of drops) factLines.push(`- PRICE DROP ${m.retailer}: \"${m.name}\" ${money(m.old)} -> ${money(m.now)} (${m.pct}%)`);\n  for (const m of rises) factLines.push(`- PRICE RISE ${m.retailer}: \"${m.name}\" ${money(m.old)} -> ${money(m.now)} (+${m.pct}%)`);\n  for (const n of newListings) factLines.push(`- NEW LISTING ${n.retailer}: \"${n.name}\" at ${money(n.price)}`);\n  for (const n of removed) factLines.push(`- REMOVED ${n.retailer}: \"${n.name}\" (was ${money(n.price)})`);\n  for (const m of ratingMoves) factLines.push(`- RATING ${m.retailer}: \"${m.name}\" ${m.old} -> ${m.now}`);\n  if (!c.has_changes) factLines.push(baselineId ? '- No price moves of ' + threshold + '% or more, no new or removed listings, no rating moves.' : '- Baseline recorded this week; changes will show from next week.');\n  factLines.push('');\n}\n\nreturn [{ json: { snapshot_id: snapshotId, categories, facts_text: factLines.join('\\n'), any_changes: categories.some(c => c.has_changes) } }];\n" }, position: [1320, 0] },
  output: [{ snapshot_id: 'snap-1', categories: [], facts_text: 'CATEGORY: Area Rug', any_changes: true }]
});
const waitBeforeAi = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait Before AI', parameters: { amount: 2 }, position: [1540, 0] },
  output: [{ facts_text: 'CATEGORY: Area Rug' }]
});
const mistral = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'Mistral - Digest',
    parameters: { model: { __rl: true, mode: 'list', value: 'ministral-14b-2512', cachedResultName: 'ministral-14b-2512' }, responsesApiEnabled: false, options: { temperature: 0.2, maxTokens: 1200 } },
    credentials: { openAiApi: { id: 'S1gjPjQ4bvcDXqeN', name: 'Mistral (OpenAI-compatible)' } },
    position: [1760, 220]
  }
});
const digestWriter = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Digest Writer',
    parameters: { promptType: 'define', text: expr('FACTS:\n{{ $json.facts_text }}'), options: { systemMessage: "You write the Monday digest for Wayfair's Rugs category managers. You get this week's competitor changes as FACTS.\n\nFor each category, write at most 3 bullets. Start each bullet with \"Act:\" or \"Watch:\".\n- Act: a change that should prompt a decision this week, such as a competitor price drop on a comparable rug, a new competitor listing in a price band where Wayfair is thin, or a falling rating.\n- Watch: worth noting, no action yet.\nName the retailer and product, and quote prices and percentages exactly as they appear in the FACTS. If a category has no changes, write one bullet: \"Watch: no changes this week.\"\n\nNever invent numbers, products, reasons for a change, or sales impact. Do not mention whether a baseline is simulated.\n\nFormat for Slack: the category name in *single asterisks* on its own line, then its bullets, each starting with \"\u2022 \". No headings, no introduction, no closing line." } },
    subnodes: { model: mistral },
    position: [1760, 0]
  },
  output: [{ output: '*Area Rug*\n• Act: ...' }]
});
const prepareCheck = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Evidence Check', parameters: { jsCode: "// Prepare Evidence Check: the AI summary may only use facts from the comparison above.\nconst facts = $('Compare Weeks').first().json;\nconst text = String($input.first().json.output || '');\nconst derived = [];\nfor (const c of facts.categories) {\n  for (const m of [...c.drops, ...c.rises]) derived.push(m.old, m.now, m.pct, Math.abs(m.pct), Math.round((m.now - m.old) * 100) / 100, Math.abs(Math.round((m.now - m.old) * 100) / 100));\n  for (const a of Object.values(c.avg_prices)) if (a.current !== null && a.previous !== null) derived.push(Math.round((a.current - a.previous) * 100) / 100);\n  derived.push(c.drops.length, c.rises.length, c.new_listings.length, c.removed.length, c.rating_moves.length);\n}\nreturn [{ json: {\n  run_id: String($execution.id),\n  workflow: 'Rug Intel Weekly Digest',\n  category_key: facts.categories.map(c => c.category_key).join(','),\n  sections: [{ name: 'Digest summary', text }],\n  source_text: facts.facts_text,\n  derived_numbers: derived,\n  min_section_chars: 60,\n  check_brand_voice: false,\n  check_past_years: false\n} }];\n" }, position: [2000, 0] },
  output: [{ run_id: '1', sections: [], source_text: '' }]
});
const evidenceCheck = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'AI Evidence Check', parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: 'GhtKfO6hrdLRzEjS', cachedResultName: 'AI Evidence Check' }, options: { waitForSubWorkflow: true } }, position: [2220, 0] },
  output: [{ verdict: 'pass', slack_text: 'ok' }]
});
const formatMessage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Slack Message', parameters: { jsCode: "// Format Slack Message: deterministic numbers first (from the comparison), then the AI's\n// act / watch summary with its evidence verdict, so nobody acts on an unchecked sentence.\nconst facts = $('Compare Weeks').first().json;\nconst ai = String($('Digest Writer').first().json.output || '').replace(/\\*\\*/g, '*').replace(/^#+\\s*/gm, '').trim();\nconst trust = $('AI Evidence Check').first().json;\nconst money = n => '$' + Number(n).toFixed(2);\nconst short = s => String(s).length > 70 ? String(s).slice(0, 67) + '...' : String(s);\nconst week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });\n\nconst parts = [`*:bar_chart: Rug Intel weekly digest, ${week}*`];\nfor (const c of facts.categories) {\n  const lines = [`\\n*${c.display_name}*` + (c.baseline_id ? ` vs ${String(c.baseline_date).slice(0, 10)}` : ' (first snapshot)') + (c.baseline_simulated ? ' _(simulated baseline for the demo)_' : '')];\n  const ap = c.avg_prices;\n  lines.push('Avg price: ' + ['Wayfair', 'Amazon', 'Walmart'].map(r => `${r} ${ap[r].current !== null ? money(ap[r].current) : 'n/a'}`).join(' \u00b7 '));\n  for (const m of c.drops.slice(0, 5)) lines.push(`:small_red_triangle_down: ${m.retailer} <${m.url}|${short(m.name)}> ${money(m.old)} \u2192 ${money(m.now)} (${m.pct}%)`);\n  for (const m of c.rises.slice(0, 3)) lines.push(`:small_red_triangle: ${m.retailer} <${m.url}|${short(m.name)}> ${money(m.old)} \u2192 ${money(m.now)} (+${m.pct}%)`);\n  if (c.new_listings.length) lines.push(`:new: ${c.new_listings.length} new: ` + c.new_listings.slice(0, 4).map(n => `${n.retailer} <${n.url}|${short(n.name)}> ${money(n.price)}`).join('; '));\n  if (c.removed.length) lines.push(`:wastebasket: ${c.removed.length} gone: ` + c.removed.slice(0, 4).map(n => `${n.retailer} ${short(n.name)}`).join('; '));\n  if (c.rating_moves.length) lines.push(':star: Rating moves: ' + c.rating_moves.slice(0, 3).map(m => `${m.retailer} ${short(m.name)} ${m.old} \u2192 ${m.now}`).join('; '));\n  if (!c.has_changes) lines.push(c.baseline_id ? `No price moves of ${c.threshold}%+ and no new or removed listings.` : 'Baseline recorded; changes show from next week.');\n  parts.push(lines.join('\\n'));\n}\nparts.push(`\\n*What it means* (AI summary, ${trust.slack_text.replace(/^\\S+\\s/, '').replace(/\\*/g, '')})\\n${ai}`);\nparts.push(`\\n<https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Open the dashboard> \u00b7 Ask a follow-up with \\`/rug-intel ask ...\\``);\n\nreturn [{ json: { text: parts.join('\\n'), verdict: trust.verdict } }];\n" }, position: [2440, 0] },
  output: [{ text: 'digest', verdict: 'pass' }]
});
const postToSlack = node({
  type: 'n8n-nodes-base.slack',
  version: 2.7,
  config: {
    name: 'Post to Slack',
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'post', select: 'channel', channelId: { __rl: true, mode: 'name', value: 'rug-intel' }, messageType: 'text', text: expr('{{ $json.text }}'), otherOptions: { includeLinkToWorkflow: false, unfurl_links: false, unfurl_media: false } },
    credentials: { slackApi: newCredential('Slack Bot (Rug Intel)') },
    position: [2660, 0]
  },
  output: [{ ok: true }]
});
const digestRows = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Digest Rows', parameters: { jsCode: "// Digest Rows: one row per category for the weekly_digests table (feeds the dashboard).\nconst facts = $('Compare Weeks').first().json;\nconst ai = String($('Digest Writer').first().json.output || '').trim();\nconst verdict = $('AI Evidence Check').first().json.verdict;\nconst createdAt = new Date().toISOString();\nreturn facts.categories.map(c => ({ json: {\n  digest_id: 'digest-' + $execution.id,\n  created_at: createdAt,\n  category_key: c.category_key,\n  baseline_id: c.baseline_id,\n  baseline_simulated: c.baseline_simulated,\n  price_drops: c.drops.length,\n  price_rises: c.rises.length,\n  new_listings: c.new_listings.length,\n  removed_listings: c.removed.length,\n  rating_moves: c.rating_moves.length,\n  details: JSON.stringify({ drops: c.drops, rises: c.rises, new_listings: c.new_listings, removed: c.removed, rating_moves: c.rating_moves, avg_prices: c.avg_prices }),\n  ai_summary: ai,\n  verdict\n} }));\n" }, position: [2880, 0] },
  output: [{ digest_id: 'digest-1' }]
});
const saveDigest = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Digest', onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'uci4LzpnpGoIEuYS', cachedResultName: 'weekly_digests' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [3100, 0] },
  output: [{ id: 1 }]
});
const buildRunLog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Run Log', executeOnce: true, parameters: { jsCode: "// Build Run Log: the digest logs to agent_runs like the other agents.\nconst facts = $('Compare Weeks').first().json;\nconst snap = $('Take Snapshot').first().json;\nconst trust = $('AI Evidence Check').first().json;\nconst posted = $('Post to Slack').first().json;\nconst warnings = [];\nif (snap._warnings) warnings.push(snap._warnings);\nif (!posted || posted.ok === false || posted.error) warnings.push('Slack post failed: ' + (posted.error && posted.error.message || posted.error || 'no response'));\nconst now = new Date().toISOString();\nreturn [{ json: {\n  run_id: String($execution.id),\n  workflow: 'Rug Intel Weekly Digest',\n  category_key: facts.categories.map(c => c.category_key).join(','),\n  focus: 'weekly change digest',\n  started_at: snap.snapshot_date,\n  finished_at: now,\n  duration_s: Math.round((new Date(now) - new Date(snap.snapshot_date)) / 1000),\n  status: warnings.length ? 'degraded' : 'ok',\n  sections_generated: facts.categories.length,\n  sections_expected: facts.categories.length,\n  warnings: warnings.join('; '),\n  trust_verdict: trust.verdict\n} }];\n" }, position: [3320, 0] },
  output: [{ run_id: '1', status: 'ok' }]
});
const saveRunLog = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Run Log', onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'qg3iqSros89SBP5a', cachedResultName: 'agent_runs' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [3540, 0] },
  output: [{ id: 1 }]
});

const seedTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Seed Simulated Baseline (demo only)', position: [0, 480] },
  output: [{}]
});
const buildBaseline = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Simulated Baseline', parameters: { jsCode: "// Build Simulated Baseline (DEMO ONLY): the sample API returns fixed prices, so a real week-over-week\n// change never happens. This writes last week's Area Rug snapshot as a copy of today's pool with\n// a few documented edits, flagged simulated = true, so the digest has something to show.\n// Edits: two Amazon prices were 15% and 12% higher, one Wayfair price was 10% lower,\n// one Walmart rating was 0.3 higher, and two Walmart listings did not exist yet.\nconst num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\\d+(?:\\.\\d+)?/); return m ? parseFloat(m[0]) : null; };\nconst pools = {};\nfor (const retailer of ['wayfair', 'amazon', 'walmart']) {\n  const res = await this.helpers.httpRequest({ method: 'GET', url: `http://34.196.186.128:8000/api/products/${retailer}`, qs: { category: 'area_rug', limit: 50 }, json: true, timeout: 30000 });\n  pools[retailer] = (res.products || []).slice().sort((a, b) => String(a.url).localeCompare(String(b.url)));\n}\nif (pools.amazon.length < 4 || pools.wayfair.length < 3 || pools.walmart.length < 10) throw new Error('The product API returned too few listings to build the simulated baseline.');\n\nconst edits = [];\nconst row = (retailer, p) => ({\n  snapshot_id: 'sim-baseline-area_rug', snapshot_date: new Date(Date.now() - 7 * 864e5).toISOString(), category_key: 'area_rug',\n  retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1), product_name: String(p.name || '').slice(0, 300), product_url: p.url,\n  price: num(p.price), rating: num(p.rating), review_count: num(p.review_count), simulated: true\n});\nconst rows = [];\nfor (const [retailer, list] of Object.entries(pools)) {\n  list.forEach((p, i) => {\n    if (retailer === 'walmart' && (i === 5 || i === 9)) { edits.push(`left out ${p.name.slice(0, 40)} (Walmart) so it shows as new`); return; }\n    const r = row(retailer, p);\n    if (retailer === 'amazon' && i === 0) { r.price = Math.round(r.price * 1.15 * 100) / 100; edits.push(`Amazon ${p.name.slice(0, 40)} was ${r.price}`); }\n    if (retailer === 'amazon' && i === 3) { r.price = Math.round(r.price * 1.12 * 100) / 100; edits.push(`Amazon ${p.name.slice(0, 40)} was ${r.price}`); }\n    if (retailer === 'wayfair' && i === 2) { r.price = Math.round(r.price * 0.9 * 100) / 100; edits.push(`Wayfair ${p.name.slice(0, 40)} was ${r.price}`); }\n    if (retailer === 'walmart' && i === 1 && r.rating) { r.rating = Math.min(5, Math.round((r.rating + 0.3) * 10) / 10); edits.push(`Walmart ${p.name.slice(0, 40)} rating was ${r.rating}`); }\n    rows.push({ json: r });\n  });\n}\nrows[0].json._edits = edits.join('; ');\nreturn rows;\n" }, position: [220, 480] },
  output: [{ snapshot_id: 'sim-baseline-area_rug' }]
});
const cleanBaseline = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Clean Baseline Rows', parameters: { jsCode: "// Clean Rows: drop helper fields (_warnings, _edits) before saving.\nreturn $input.all().map(i => { const { _warnings, _edits, ...row } = i.json; return { json: row }; });\n" }, position: [440, 480] },
  output: [{ snapshot_id: 'sim-baseline-area_rug' }]
});
const saveBaseline = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Baseline', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'UpvsZllfjXQmaKh1', cachedResultName: 'listing_snapshots' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [660, 480] },
  output: [{ id: 1 }]
});

const mainNote = sticky("## Rug Intel Weekly Digest (beyond the brief)\nEvery Monday 8am ET: snapshot the full listing pool for each category with `weekly_digest = true` in `category_config`, compare product by product with last week, and post what changed to Slack #rug-intel.\n- Numbers in the message come straight from the comparison (no AI).\n- **Digest Writer** adds 3 Act / Watch bullets; the shared **AI Evidence Check** verifies them against the facts and its verdict is shown in the message.\n- Results go to `weekly_digests` (dashboard) and `agent_runs` (run health).", [], { color: 5, width: 620, height: 260, position: [0, -320] });
const seedNote = sticky("## Demo only: simulated baseline\nThe sample API returns fixed prices, so real week-over-week changes never happen. Run this branch once to write \"last week\" for Area Rug as a copy of today's pool with documented edits (2 Amazon prices higher, 1 Wayfair price lower, 1 Walmart rating higher, 2 Walmart listings left out). Rows are flagged `simulated = true` and the Slack message says so.", [], { color: 3, width: 620, height: 200, position: [0, 640] });

export default workflow('rug-intel-weekly-digest', 'Rug Intel Weekly Digest')
  .add(everyMonday).to(digestCategories).to(takeSnapshot).to(cleanSnapshot).to(saveSnapshot).to(snapshotHistory).to(compareWeeks)
  .to(waitBeforeAi).to(digestWriter).to(prepareCheck).to(evidenceCheck).to(formatMessage).to(postToSlack)
  .to(digestRows).to(saveDigest).to(buildRunLog).to(saveRunLog)
  .add(seedTrigger).to(buildBaseline).to(cleanBaseline).to(saveBaseline)
  .add(mainNote).add(seedNote);
