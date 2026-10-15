import { workflow, node, trigger, sticky, languageModel, expr } from '@n8n/workflow-sdk';

const fromSlack = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'When Called by Slack', parameters: { inputSource: 'workflowInputs', workflowInputs: { values: [{ name: 'question', type: 'string' }, { name: 'asked_by', type: 'string' }] } }, position: [0, 0] },
  output: [{ question: 'Which Walmart area rugs under $50 have the best ratings?', asked_by: 'dhruv' }]
});
const fromChat = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: { name: 'Ask in n8n Chat', parameters: { options: {} }, position: [0, 220] },
  output: [{ chatInput: 'Which Walmart area rugs under $50 have the best ratings?', sessionId: 's1' }]
});
const readQuestion = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Read Question', parameters: { jsCode: "// Read Question: the same agent answers from Slack (/rug-intel ask) or from the n8n chat.\nlet question = '';\nlet askedBy = '';\ntry { const t = $('When Called by Slack').first().json; question = t.question || ''; askedBy = t.asked_by || ''; } catch (e) { /* not called from Slack */ }\ntry { question = question || $('Ask in n8n Chat').first().json.chatInput || ''; askedBy = askedBy || 'n8n chat'; } catch (e) { /* not called from chat */ }\nquestion = String(question).trim();\nif (!question) throw new Error('No question received. Ask something like: which Walmart area rugs under $50 have the best ratings?');\nreturn [{ json: { question, asked_by: askedBy, started_at: new Date().toISOString() } }];\n" }, position: [240, 100] },
  output: [{ question: 'Which Walmart area rugs under $50 have the best ratings?', asked_by: 'dhruv', started_at: '2026-10-15T12:00:00Z' }]
});
const getCategories = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Categories', executeOnce: true, alwaysOutputData: true, parameters: {"resource": "row", "operation": "get", "dataTableId": {"__rl": true, "mode": "id", "value": "4KeWqQ88qv3lJNV5", "cachedResultName": "category_config"}, "returnAll": true}, position: [460, 100] },
  output: [{ id: 1, category_key: 'area_rug' }]
});
const getSnapshots = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Snapshots', executeOnce: true, alwaysOutputData: true, parameters: {"resource": "row", "operation": "get", "dataTableId": {"__rl": true, "mode": "id", "value": "UpvsZllfjXQmaKh1", "cachedResultName": "listing_snapshots"}, "orderBy": true, "orderByColumn": "createdAt", "orderByDirection": "DESC", "returnAll": false, "limit": 1000}, position: [680, 100] },
  output: [{ id: 1, category_key: 'area_rug' }]
});
const getRunListings = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Run Listings', executeOnce: true, alwaysOutputData: true, parameters: {"resource": "row", "operation": "get", "dataTableId": {"__rl": true, "mode": "id", "value": "mqIkLKIlYoPiQmU5", "cachedResultName": "competitor_listings"}, "orderBy": true, "orderByColumn": "createdAt", "orderByDirection": "DESC", "returnAll": false, "limit": 500}, position: [900, 100] },
  output: [{ id: 1, category_key: 'area_rug' }]
});
const buildContext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Context', parameters: { jsCode: "// Build Context: pick the categories the question is about and give the agent their latest listings,\n// each with a short ID it must cite (AR-W3 = Area Rug, Wayfair, listing 3), plus computed statistics.\nconst q = $('Read Question').first().json.question;\nconst rows = name => $(name).all().map(i => i.json).filter(r => r && r.id !== undefined);\nconst config = rows('Get Categories').filter(c => c.active !== false);\nconst snapshots = rows('Get Snapshots').filter(r => r.simulated !== true);\nconst runs = rows('Get Run Listings');\n\nconst lower = q.toLowerCase();\nconst mentioned = config.filter(c => String(c.patterns || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean)\n  .concat([String(c.display_name || '').toLowerCase(), c.category_key]).some(p => p && lower.includes(p)));\nconst ABBR = { area_rug: 'AR', outdoor_rug: 'OR', hallway_runner: 'HR', shag_rug: 'SR' };\nconst LETTER = { Wayfair: 'W', Amazon: 'A', Walmart: 'M' };\n\nconst latest = (list, idField, dateField, key) => {\n  const forCat = list.filter(r => r.category_key === key);\n  if (!forCat.length) return null;\n  const newest = forCat.reduce((a, b) => new Date(b[dateField]) > new Date(a[dateField]) ? b : a);\n  return { id: newest[idField], date: newest[dateField], rows: forCat.filter(r => r[idField] === newest[idField]) };\n};\n\nconst stats = vals => {\n  const v = vals.filter(x => x !== null && x !== undefined).map(Number).sort((a, b) => a - b);\n  if (!v.length) return null;\n  const sum = v.reduce((a, b) => a + b, 0);\n  const mid = Math.floor(v.length / 2);\n  const r2 = n => Math.round(n * 100) / 100;\n  return { n: v.length, avg: r2(sum / v.length), median: v.length % 2 ? v[mid] : r2((v[mid - 1] + v[mid]) / 2), min: v[0], max: v[v.length - 1] };\n};\n\nconst blocks = [];\nconst derived = [];\nconst ids = [];\nconst datasets = [];\nfor (const cat of (mentioned.length ? mentioned : config)) {\n  const snap = latest(snapshots, 'snapshot_id', 'snapshot_date', cat.category_key);\n  const run = latest(runs, 'run_id', 'run_date', cat.category_key);\n  const use = snap || run;\n  if (!use) continue;\n  const label = snap ? `weekly snapshot of ${String(snap.date).slice(0, 10)}, full listing pool` : `deep-dive run ${run.id} of ${String(run.date).slice(0, 10)}, 10-listing sample per retailer`;\n  datasets.push(`${cat.display_name}: ${label} (${use.rows.length} listings)`);\n  const lines = [`CATEGORY ${cat.display_name} (source: ${label})`];\n  const counters = {};\n  const listingLines = [];\n  for (const retailer of ['Wayfair', 'Amazon', 'Walmart']) {\n    const items = use.rows.filter(r => r.retailer === retailer).sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));\n    const p = stats(items.map(i => i.price));\n    const r = stats(items.map(i => i.rating));\n    if (p) {\n      lines.push(`STATS ${retailer}: ${p.n} listings, price avg $${p.avg}, median $${p.median}, min $${p.min}, max $${p.max}` + (r ? `; rating avg ${r.avg}, min ${r.min}, max ${r.max}` : ''));\n      derived.push(p.n, p.avg, p.median, p.min, p.max);\n      if (r) derived.push(r.avg, r.min, r.max);\n      derived.push(items.filter(i => i.price < 50).length, items.filter(i => i.price < 100).length);\n    }\n    for (const it of items) {\n      counters[retailer] = (counters[retailer] || 0) + 1;\n      const id = `${ABBR[cat.category_key] || cat.category_key.slice(0, 2).toUpperCase()}-${LETTER[retailer]}${counters[retailer]}`;\n      ids.push(id);\n      listingLines.push(`${id} | ${retailer} | ${String(it.product_name).slice(0, 110)} | ${it.price !== null ? '$' + it.price : 'no price'} | ${it.rating ?? 'no rating'} stars | ${it.review_count ?? 0} reviews`);\n    }\n  }\n  lines.push('LISTINGS (ID | retailer | product | price | rating | reviews), cheapest first:', ...listingLines);\n  blocks.push(lines.join('\\n'));\n}\nif (!blocks.length) throw new Error('No listings are stored yet. Run a deep dive or the weekly digest first.');\n\nreturn [{ json: {\n  question: q,\n  context_text: blocks.join('\\n\\n'),\n  derived_numbers: derived,\n  valid_ids: ids,\n  datasets: datasets.join('; '),\n  categories: (mentioned.length ? mentioned : config).map(c => c.category_key).join(',')\n} }];\n" }, position: [1120, 100] },
  output: [{ question: 'q', context_text: 'CATEGORY Area Rug', derived_numbers: [1], valid_ids: ['AR-W1'], datasets: 'Area Rug', categories: 'area_rug' }]
});
const waitBeforeAi = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait Before AI', parameters: { amount: 2 }, position: [1340, 100] },
  output: [{ question: 'q', context_text: 'CATEGORY Area Rug' }]
});
const mistral = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'Mistral - Ask',
    parameters: { model: { __rl: true, mode: 'list', value: 'ministral-14b-2512', cachedResultName: 'ministral-14b-2512' }, responsesApiEnabled: false, options: { temperature: 0.2, maxTokens: 900 } },
    credentials: { openAiApi: { id: 'S1gjPjQ4bvcDXqeN', name: 'Mistral (OpenAI-compatible)' } },
    position: [1560, 320]
  }
});
const answerAgent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Answer Agent',
    parameters: { promptType: 'define', text: expr('QUESTION: {{ $json.question }}\n\n{{ $json.context_text }}'), options: { systemMessage: "You are Rug Intel, an analyst assistant for Wayfair's Rugs category managers. Answer the QUESTION using only the LISTINGS and STATS provided.\n\n- Start with the direct answer in one or two sentences.\n- Then give up to 4 bullets, each starting with \"\u2022 \", with the evidence. Cite every listing you mention by its ID in square brackets, for example [AR-M4].\n- Quote prices, ratings and review counts exactly as listed. You may compute simple counts, averages or differences from the listings; say what you computed.\n- If the data cannot answer the question (for example sales, margins, traffic, stock or future prices), say so plainly and name the data that would be needed.\n- Never invent products, numbers, causes or recommendations the data does not support.\n- Slack formatting: *single asterisks* for bold, no headings, no tables." } },
    subnodes: { model: mistral },
    position: [1560, 100]
  },
  output: [{ output: 'The best-rated Walmart rug under $50 is ... [AR-M4]' }]
});
const prepareCheck = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Prepare Evidence Check', parameters: { jsCode: "// Prepare Evidence Check: the answer may only use the listings and statistics it was given.\nconst ctx = $('Build Context').first().json;\nreturn [{ json: {\n  run_id: String($execution.id),\n  workflow: 'Rug Intel Ask',\n  category_key: ctx.categories,\n  sections: [{ name: 'Answer', text: String($input.first().json.output || '') }],\n  source_text: ctx.context_text,\n  derived_numbers: ctx.derived_numbers,\n  min_section_chars: 40,\n  check_brand_voice: false,\n  check_past_years: false\n} }];\n" }, position: [1800, 100] },
  output: [{ run_id: '1' }]
});
const evidenceCheck = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: { name: 'AI Evidence Check', parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: 'GhtKfO6hrdLRzEjS', cachedResultName: 'AI Evidence Check' }, options: { waitForSubWorkflow: true } }, position: [2020, 100] },
  output: [{ verdict: 'pass', slack_text: 'ok' }]
});
const formatAnswer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Answer', parameters: { jsCode: "// Format Answer: the answer, its evidence verdict, and any citation that points at a listing that doesn't exist.\nconst ctx = $('Build Context').first().json;\nconst trust = $('AI Evidence Check').first().json;\nconst answer = String($('Answer Agent').first().json.output || '').replace(/\\*\\*/g, '*').replace(/^#+\\s*/gm, '').trim();\nconst cited = [...new Set((answer.match(/\\b[A-Z]{2}-[WAM]\\d+\\b/g) || []))];\nconst unknown = cited.filter(id => !ctx.valid_ids.includes(id));\nconst notes = [trust.slack_text];\nif (!cited.length) notes.push(':grey_question: The answer cites no listing IDs, so check it against the dashboard.');\nif (unknown.length) notes.push(`:warning: Cites listings that do not exist: ${unknown.join(', ')}.`);\nconst output = `${answer}\\n\\n${notes.join('\\n')}\\n_Data: ${ctx.datasets}._`;\nreturn [{ json: { output, answer, verdict: unknown.length && trust.verdict === 'pass' ? 'review' : trust.verdict, cited, unknown_citations: unknown, question: ctx.question } }];\n" }, position: [2240, 100] },
  output: [{ output: 'answer', verdict: 'pass', cited: [], unknown_citations: [] }]
});
const buildRunLog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Run Log', parameters: { jsCode: "// Build Run Log: Q&A answers are logged like every other agent run.\nconst q = $('Read Question').first().json;\nconst f = $('Format Answer').first().json;\nconst ctx = $('Build Context').first().json;\nconst now = new Date();\nconst warnings = [];\nif (f.unknown_citations.length) warnings.push('unknown citations: ' + f.unknown_citations.join(', '));\nif (!f.cited.length) warnings.push('no citations');\nreturn [{ json: {\n  run_id: String($execution.id),\n  workflow: 'Rug Intel Ask',\n  category_key: ctx.categories,\n  focus: q.question.slice(0, 200),\n  started_at: q.started_at,\n  finished_at: now.toISOString(),\n  duration_s: Math.round((now - new Date(q.started_at)) / 1000),\n  status: warnings.length ? 'degraded' : 'ok',\n  sections_generated: 1,\n  sections_expected: 1,\n  warnings: warnings.join('; '),\n  trust_verdict: f.verdict\n} }];\n" }, position: [2460, 100] },
  output: [{ run_id: '1' }]
});
const saveRunLog = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Run Log', onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'qg3iqSros89SBP5a', cachedResultName: 'agent_runs' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [2680, 100] },
  output: [{ id: 1 }]
});
const returnAnswer = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Return Answer', parameters: { jsCode: "// Return Answer: Slack and the n8n chat both read `output`.\nreturn [{ json: $('Format Answer').first().json }];\n" }, position: [2900, 100] },
  output: [{ output: 'answer' }]
});
const note = sticky("## Rug Intel Ask (beyond the brief)\nQ&A agent for category managers, called by Slack `/rug-intel ask <question>` or from the n8n chat (fallback).\n- **Build Context** picks the categories named in the question and loads their latest stored listings (weekly snapshot, else the latest deep dive), each with a citable ID such as AR-M4, plus computed stats.\n- **Answer Agent** must cite IDs and use only that data.\n- **AI Evidence Check** + a citation check flag invented numbers or listings before the answer is shown.\nRetrieval is done in code rather than by agent tool calls: cheaper and more reliable on the free model. In production this becomes a BigQuery tool on Vertex AI.", [], { color: 5, width: 600, height: 300, position: [0, -360] });

export default workflow('rug-intel-ask', 'Rug Intel Ask')
  .add(fromSlack).to(readQuestion)
  .add(fromChat).to(readQuestion)
  .add(readQuestion).to(getCategories).to(getSnapshots).to(getRunListings).to(buildContext).to(waitBeforeAi).to(answerAgent)
  .to(prepareCheck).to(evidenceCheck).to(formatAnswer).to(buildRunLog).to(saveRunLog).to(returnAnswer)
  .add(note);
