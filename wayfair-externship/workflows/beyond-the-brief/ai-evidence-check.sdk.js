import { workflow, node, trigger, sticky, languageModel, ifElse, expr } from '@n8n/workflow-sdk';

const whenCalled = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: { name: 'When Called by Another Workflow', parameters: { inputSource: 'passthrough' }, position: [0, 300] },
  output: [{ run_id: '90', workflow: 'Phase 3', category_key: 'area_rug', sections: [{ name: 'Executive Summary', text: '<p>Wayfair averages $170.09</p>' }], source_text: '{}', derived_numbers: [170.09] }]
});

const deterministic = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Deterministic Checks', parameters: { jsCode: "// Deterministic Checks: audit AI output against its source data without trusting the AI.\n// Checks every number, banned phrases, past years, reused example lines and non-answers,\n// then picks up to 12 factual sentences for the AI claim-support step.\nconst input = $input.first().json;\nconst toArray = v => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch (e) { return v.split('\\n'); } })() : []);\n\nconst stripHtml = s => String(s || '')\n  .replace(/<(style|script)[^>]*>[\\s\\S]*?<\\/\\1>/gi, ' ')\n  .replace(/<[^>]+>/g, ' ')\n  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, \"'\")\n  .replace(/```[a-z]*|```/gi, ' ')\n  .replace(/\\*\\*|__/g, '')\n  .replace(/\\s+/g, ' ').trim();\n\n// Sections: [{name, text}]. A single ai_text is treated as one section.\nlet sections = toArray(input.sections).filter(s => s && typeof s === 'object');\nif (!sections.length) sections = [{ name: 'Output', text: input.ai_text || '' }];\nsections = sections.map(s => ({ name: String(s.name || 'Section'), text: stripHtml(s.text) }));\nconst aiText = sections.map(s => s.text).join('\\n');\n\nconst sourceRaw = stripHtml(input.source_text);\nconst sourceText = sourceRaw.replace(/,(?=\\d{3})/g, '');\nconst derived = toArray(input.derived_numbers).map(Number).filter(n => Number.isFinite(n));\n\n// 1. Non-answers: a section that is nearly empty or is a refusal / classifier label, not analysis.\nconst REFUSAL = /^(user safety|safe|unsafe)\\b|\\bI (?:can't|cannot|am unable to|'m unable to) (?:help|assist|provide|complete)|\\bas an AI (?:language )?model\\b|^I'm sorry/i;\nconst nonAnswers = sections\n  .filter(s => s.text.length < Number(input.min_section_chars || 200) || REFUSAL.test(s.text.slice(0, 200)))\n  .map(s => ({ section: s.name, length: s.text.length, starts_with: s.text.slice(0, 80) }));\n\n// 2. Numbers: each must appear in the source exactly, or match a statistic computed from it (within rounding).\nconst scrubbed = aiText\n  .replace(/\\b\\d+(?:\\.\\d+)?\\s?(?:'|ft|feet|foot)?\\s?[x\u00d7]\\s?\\d+(?:\\.\\d+)?\\s?(?:'|ft|feet|foot|in)?\\b/gi, ' ')  // rug sizes like 8x10, 5' x 7'\n  .replace(/\\b(?:19|20)\\d{2}\\b/g, ' ');                                                               // years are checked separately\nconst NUMBER = /\\$\\s?\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\$\\s?\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s?%|\\b\\d+\\.\\d+\\b|\\b\\d{1,3}(?:,\\d{3})+\\b|\\b\\d{2,}\\b/g;\nconst valueOf = n => parseFloat(n.replace(/[$,%]/g, ''));\n// Round dollar amounts ($50, $100, $300...) are price bands or targets, not facts about a listing.\nconst isThreshold = n => n.startsWith('$') && !n.includes('.') && valueOf(n) >= 50 && valueOf(n) % 50 === 0;\nconst found = [...new Set((scrubbed.match(NUMBER) || []).map(n => n.replace(/\\s/g, '')))];\nconst thresholdsSkipped = found.filter(isThreshold);\nconst numbers = found.filter(n => !isThreshold(n));\n// A whole number that is a real source value rounded or cut off ($29 for $29.99) counts as found.\nconst sourceValues = (sourceText.match(/\\d+\\.\\d+/g) || []).map(Number);\nconst inSource = n => {\n  const core = n.replace(/[$,%]/g, '');\n  return new RegExp('(^|[^\\\\d.])' + core.replace('.', '\\\\.') + '(?![\\\\d]|\\\\.\\\\d)').test(sourceText);\n};\nconst nearDerived = n => {\n  const v = valueOf(n);\n  // Whole numbers may be rounded; a number written to the cent must match to the cent.\n  const decimals = (n.split('.')[1] || '').replace(/\\D/g, '').length;\n  const tolerance = d => decimals === 0 ? Math.max(0.5, Math.abs(d) * 0.01) : 0.6 / Math.pow(10, decimals);\n  if (derived.some(d => Math.abs(v - d) <= tolerance(d))) return true;\n  return Number.isInteger(v) && sourceValues.some(s => Math.floor(s) === v || Math.round(s) === v);\n};\nconst unsupportedNumbers = numbers.filter(n => !inSource(n) && !nearDerived(n));\n\n// 3. Banned phrases (brand voice), reused example lines, past years.\nconst DEFAULT_BANNED = ['elevate', 'elevated', 'curated', 'curation', 'seamless', 'seamlessly', 'timeless elegance',\n  'must-have', 'game-changer', 'unlock', 'transform your space', 'fast-paced world', 'look no further',\n  'stunning', 'shop now', 'buy now', \"don't miss out\", 'link in bio'];\nconst banned = toArray(input.banned_phrases).length ? toArray(input.banned_phrases) : (input.check_brand_voice ? DEFAULT_BANNED : []);\nconst fullAi = sections.map(s => s.text).join(' ');\nconst bannedPhrases = banned\n  .map(phrase => ({ phrase, count: (fullAi.match(new RegExp('\\\\b' + String(phrase).replace(/[-'.*+?^${}()|[\\]\\\\]/g, m => '\\\\' + m) + 's?\\\\b', 'gi')) || []).length }))\n  .filter(b => b.count > 0);\n\nconst lowerAi = fullAi.toLowerCase().replace(/[\u2018\u2019]/g, \"'\");\nconst reusedExamples = toArray(input.example_lines).filter(line => line && lowerAi.includes(String(line).toLowerCase()));\n\nconst thisYear = new Date().getFullYear();\nconst pastYears = input.check_past_years\n  ? [...new Set((fullAi.match(/\\b(?:19|20)\\d{2}\\b/g) || []).filter(y => Number(y) < thisYear && !sourceText.includes(y)))]\n  : [];\n\n// 4. Claims for the AI step: sentences with a number or a comparison (the ones most likely to be wrong),\n//    spread across sections so one long section doesn't use up the 12 slots.\nconst CLAIMY = /\\d|cheaper|pricier|higher|lower|more|fewer|most|least|only|leads?|dominat|outperform|lacks?|gap|best|worst/i;\nconst splitSentences = t => t.split(/(?<!\\b(?:avg|e\\.g|i\\.e|vs|approx|est))(?<=[.!?])\\s+(?=[A-Z\"'$])/).map(x => x.trim());\nconst perSection = Math.max(2, Math.ceil(12 / Math.max(1, sections.length - nonAnswers.length)));\nconst claims = [];\nfor (const s of sections) {\n  const candidates = [...new Set(splitSentences(s.text))].filter(x => x.length >= 40 && x.length <= 320 && CLAIMY.test(x));\n  candidates.sort((a, b) => /\\d/.test(b) - /\\d/.test(a));\n  claims.push(...candidates.slice(0, perSection));\n}\nclaims.splice(12);\n\nconst sourceTooThin = sourceRaw.length < 300;\n\nreturn [{\n  json: {\n    run_id: String(input.run_id || ''),\n    workflow: String(input.workflow || ''),\n    category_key: String(input.category_key || ''),\n    sections_checked: sections.length,\n    source_chars: sourceRaw.length,\n    source_too_thin: sourceTooThin,\n    non_answers: nonAnswers,\n    numbers_checked: numbers.length,\n    thresholds_skipped: thresholdsSkipped,\n    numbers_found: numbers.length - unsupportedNumbers.length,\n    unsupported_numbers: unsupportedNumbers,\n    banned_phrases: bannedPhrases,\n    reused_examples: reusedExamples,\n    past_years: pastYears,\n    claims,\n    claim_prompt: [\n      'SOURCE DATA:', sourceRaw.slice(0, 30000),\n      input.derived_summary ? '\\nSTATISTICS COMPUTED FROM THE SOURCE DATA:\\n' + input.derived_summary : '',\n      '\\nCLAIMS TO CHECK:', claims.map((c, i) => `${i + 1}. ${c}`).join('\\n')\n    ].join('\\n')\n  }\n}];\n" }, position: [240, 300] },
  output: [{ run_id: '90', claims: ['Wayfair averages $170.09.'], claim_prompt: 'SOURCE DATA: ...', non_answers: [], numbers_checked: 1, numbers_found: 1, unsupported_numbers: [] }]
});

const anyClaims = ifElse({
  version: 2.2,
  config: {
    name: 'Any Claims?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.claims.length }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
        combinator: 'and'
      }
    },
    position: [480, 300]
  }
});

const waitBeforeAi = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: { name: 'Wait Before AI Check', parameters: { amount: 2 }, position: [720, 200] },
  output: [{ claim_prompt: 'SOURCE DATA: ...' }]
});

const mistralModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'Mistral - Claim Check',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'ministral-14b-2512', cachedResultName: 'ministral-14b-2512' },
      responsesApiEnabled: false,
      options: { temperature: 0, maxTokens: 2500 }
    },
    credentials: { openAiApi: { id: 'S1gjPjQ4bvcDXqeN', name: 'Mistral (OpenAI-compatible)' } },
    position: [960, 420]
  }
});

const claimCheck = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Claim Support Check',
    onError: 'continueRegularOutput',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.claim_prompt }}'),
      options: { systemMessage: "You are a fact checker for Wayfair's category teams. You receive SOURCE DATA (product listings or reports) and numbered CLAIMS written by another AI.\n\nFor each claim decide:\n- supported: the source data states it, or it follows from the source by simple arithmetic (an average, a count, a min or max, a difference).\n- unsupported: the source data contradicts it, or it states a fact (number, product, brand, retailer behaviour) that is not in the source.\n- unclear: it is an opinion, a recommendation or a plan, not a factual claim about the data.\n\nBe strict about numbers: a price, rating, count or average that does not match the source is unsupported, even if it is close.\n\nReply with a JSON array only, one object per claim, no text before or after and no code fences:\n[{\"id\": 1, \"verdict\": \"supported\", \"reason\": \"one short sentence citing the source values\"}]" }
    },
    subnodes: { model: mistralModel },
    position: [960, 200]
  },
  output: [{ output: '[{"id":1,"verdict":"supported","reason":"Wayfair average price is 170.09"}]' }]
});

const verdict = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Verdict', parameters: { jsCode: "// Verdict: combine the rule checks and the AI claim check into pass / review / block,\n// and render the same result as an HTML Trust box (reports) and a short text (Slack).\nconst d = $('Deterministic Checks').first().json;\n\n// AI claim check (optional): a JSON list of {id, verdict, reason}. If it failed, say so instead of guessing.\nlet claimResults = [];\nlet aiCheck = 'skipped (no factual claims found)';\nif (d.claims.length) {\n  aiCheck = 'unavailable (the AI check did not return a usable answer)';\n  try {\n    const raw = String($('Claim Support Check').first().json.output || '');\n    const m = raw.replace(/```json|```/g, '').match(/\\[[\\s\\S]*\\]/);\n    if (m) {\n      const parsed = JSON.parse(m[0]);\n      claimResults = parsed\n        .filter(r => r && Number.isInteger(Number(r.id)) && d.claims[Number(r.id) - 1])\n        .map(r => ({ claim: d.claims[Number(r.id) - 1], verdict: String(r.verdict || 'unclear').toLowerCase(), reason: String(r.reason || '').slice(0, 300) }));\n      if (claimResults.length) aiCheck = 'done';\n    }\n  } catch (e) { /* keep \"unavailable\" */ }\n}\nconst unsupportedClaims = claimResults.filter(r => r.verdict === 'unsupported');\n\n// Verdict rules (deliberately simple so a category manager can follow them):\n//  block  - no usable source data, a section that is a non-answer, or most numbers / claims unsupported\n//  review - anything else flagged\n//  pass   - nothing flagged\nconst reasons = [];\nlet verdict = 'pass';\nconst numberShare = d.numbers_checked ? d.numbers_found / d.numbers_checked : 1;\nif (d.source_too_thin) reasons.push('the source data is almost empty, so nothing can be verified');\nfor (const n of d.non_answers) reasons.push(`\"${n.section}\" is not a real answer (${n.length} characters: \"${n.starts_with}\")`);\nif (d.numbers_checked >= 5 && numberShare < 0.6) reasons.push(`only ${d.numbers_found} of ${d.numbers_checked} numbers trace back to the source`);\nif (claimResults.length >= 3 && unsupportedClaims.length / claimResults.length >= 0.5) reasons.push(`${unsupportedClaims.length} of ${claimResults.length} checked claims are not supported by the source`);\nif (reasons.length) verdict = 'block';\n\nconst flags = [];\nif (d.unsupported_numbers.length) flags.push(`${d.unsupported_numbers.length} number(s) not found in the source: ${d.unsupported_numbers.join(', ')}`);\nif (unsupportedClaims.length) flags.push(`${unsupportedClaims.length} claim(s) the AI check could not support`);\nif (d.banned_phrases.length) flags.push('banned phrases: ' + d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '));\nif (d.past_years.length) flags.push('past years: ' + d.past_years.join(', '));\nif (d.reused_examples.length) flags.push('reused example lines: ' + d.reused_examples.join(', '));\nif (verdict === 'pass' && flags.length) verdict = 'review';\n\nconst LABEL = { pass: 'PASS', review: 'REVIEW', block: 'BLOCK' };\nconst ICON = { pass: '\u2705', review: '\u26a0\ufe0f', block: '\u26d4' };\nconst summary = verdict === 'pass'\n  ? `All ${d.numbers_checked} numbers trace back to the source and nothing was flagged.`\n  : verdict === 'review'\n    ? `Usable, but check before sharing: ${flags.join('; ')}.`\n    : `Do not share as is: ${reasons.join('; ')}.${flags.length ? ' Also: ' + flags.join('; ') + '.' : ''}`;\n\nconst esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst COLOR = { pass: '#059669', review: '#d97706', block: '#dc2626' };\nconst li = (label, value) => `<li style=\"margin:4px 0\"><strong>${label}:</strong> ${value}</li>`;\nconst trustHtml = `\n<section class=\"trust-check\" style=\"margin:0 0 2rem;padding:1.25rem 1.5rem;border:1px solid #e5e7eb;border-left:6px solid ${COLOR[verdict]};border-radius:8px;background:#fff\">\n  <h2 style=\"border:none;margin:0 0 .5rem;font-size:1.3rem\">${ICON[verdict]} AI Evidence Check: ${LABEL[verdict]}</h2>\n  <p style=\"margin:0 0 .75rem;color:#374151\">${esc(summary)}</p>\n  <ul style=\"margin:0 0 0 1.2rem;color:#374151\">\n    ${li('Numbers', `${d.numbers_found} of ${d.numbers_checked} found in the source data or computed from it${d.unsupported_numbers.length ? '. Not found: ' + esc(d.unsupported_numbers.join(', ')) : ''}`)}\n    ${li('Sections', d.non_answers.length ? 'non-answers: ' + esc(d.non_answers.map(n => n.section).join(', ')) : `all ${d.sections_checked} contain real content`)}\n    ${li('Claims (AI check)', aiCheck === 'done' ? `${claimResults.length - unsupportedClaims.length} of ${claimResults.length} supported` : esc(aiCheck))}\n    ${unsupportedClaims.length ? li('Unsupported claims', '<ul style=\"margin:4px 0 0 1.2rem\">' + unsupportedClaims.map(c => `<li>${esc(c.claim)}<br><span style=\"color:#6b7280\">${esc(c.reason)}</span></li>`).join('') + '</ul>') : ''}\n    ${d.banned_phrases.length ? li('Banned phrases', esc(d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '))) : ''}\n    ${d.past_years.length ? li('Past years', esc(d.past_years.join(', '))) : ''}\n    ${d.reused_examples.length ? li('Reused example lines', esc(d.reused_examples.join(', '))) : ''}\n  </ul>\n  <p style=\"margin:.75rem 0 0;font-size:.85rem;color:#6b7280\">Checked automatically: numbers against the listing data (exact, or a statistic computed from it), every section for a real answer, and up to 12 factual sentences by a second AI pass. A pass means traceable, not necessarily right; numbers can still be used out of context.</p>\n</section>`;\n\nconst slackText = `${ICON[verdict]} *Evidence check: ${LABEL[verdict]}*. ${summary}`;\n\nreturn [{\n  json: {\n    run_id: d.run_id,\n    workflow: d.workflow,\n    category_key: d.category_key,\n    checked_at: new Date().toISOString(),\n    verdict,\n    numbers_checked: d.numbers_checked,\n    numbers_found: d.numbers_found,\n    unsupported_numbers: d.unsupported_numbers.join(', '),\n    non_answers: d.non_answers.map(n => n.section).join(', '),\n    banned_phrases: d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '),\n    past_years: d.past_years.join(', '),\n    reused_examples: d.reused_examples.join(', '),\n    claims_checked: claimResults.length,\n    claims_unsupported: unsupportedClaims.length,\n    unsupported_claims: JSON.stringify(unsupportedClaims),\n    ai_check: aiCheck,\n    summary,\n    trust_html: trustHtml,\n    slack_text: slackText\n  }\n}];\n" }, position: [1240, 300] },
  output: [{ run_id: '90', verdict: 'pass', summary: 'ok', trust_html: '<section></section>', slack_text: 'ok' }]
});

const tableRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Table Row', parameters: { jsCode: "// Table Row: keep only the evidence_checks columns (the HTML and Slack text go back to the caller, not the table).\nconst v = $input.first().json;\nconst COLUMNS = ['run_id', 'workflow', 'category_key', 'checked_at', 'verdict', 'numbers_checked', 'numbers_found',\n  'unsupported_numbers', 'non_answers', 'banned_phrases', 'past_years', 'reused_examples', 'claims_checked',\n  'claims_unsupported', 'unsupported_claims', 'ai_check', 'summary'];\nconst row = {};\nfor (const c of COLUMNS) row[c] = v[c];\nreturn [{ json: row }];\n" }, position: [1480, 300] },
  output: [{ run_id: '90', verdict: 'pass' }]
});

const saveCheck = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save Evidence Check',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'id', value: '3P6SaFdSLZADwlGG', cachedResultName: 'evidence_checks' },
      columns: { mappingMode: 'autoMapInputData', value: null },
      options: {}
    },
    position: [1720, 300]
  },
  output: [{ id: 1, run_id: '90' }]
});

const returnResult = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Return Result', parameters: { jsCode: "// Return Result: the calling workflow receives the full verdict, Trust box HTML and Slack text.\nreturn [{ json: $('Verdict').first().json }];\n" }, position: [1960, 300] },
  output: [{ run_id: '90', verdict: 'pass' }]
});

const note = sticky("## AI Evidence Check (shared sub-workflow)\nAny agent workflow can call this before its output reaches a person.\n\n**Input** (one item): `run_id`, `workflow`, `category_key`, `sections` [{name, text}] or `ai_text`, `source_text`, optional `derived_numbers` (statistics the AI may compute), `derived_summary`, `banned_phrases`, `example_lines`, `check_past_years`, `check_brand_voice`.\n\n**Checks:** every number against the source (exact, or a computed statistic within rounding) \u00b7 non-answer sections \u00b7 banned phrases \u00b7 past years \u00b7 reused example lines \u00b7 up to 12 factual sentences re-checked by a second AI pass.\n\n**Output:** `verdict` pass / review / block, `summary`, `trust_html` (box for reports), `slack_text`. Each result is saved to the `evidence_checks` table.", [], { color: 5, width: 560, height: 380, position: [0, -200] });

export default workflow('ai-evidence-check', 'AI Evidence Check')
  .add(whenCalled)
  .to(deterministic)
  .to(anyClaims
    .onTrue(waitBeforeAi.to(claimCheck).to(verdict))
    .onFalse(verdict))
  .add(verdict)
  .to(tableRow)
  .to(saveCheck)
  .to(returnResult)
  .add(note);
