import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const slackRequest = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Slack Request', parameters: { httpMethod: 'POST', path: 'rug-intel/slack', responseMode: 'responseNode', options: { rawBody: true } }, position: [0, 300] },
  output: [{ headers: { 'x-slack-signature': 'v0=abc', 'x-slack-request-timestamp': '1792100000' }, body: { text: 'deep-dive area rug', user_id: 'U1', response_url: 'https://hooks.slack.com/x' } }]
});
const readRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Read Slack Request', parameters: { jsCode: "// Read Slack Request: rebuild the exact string Slack signed (\"v0:<timestamp>:<raw body>\") and read the command.\n// Slack docs: https://api.slack.com/authentication/verifying-requests-from-slack\nconst item = $input.first();\nconst headers = item.json.headers || {};\nconst body = item.json.body || {};\nlet raw = '';\nif (item.binary && item.binary.data) raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');\nif (!raw) raw = new URLSearchParams(body).toString();\n\nconst timestamp = String(headers['x-slack-request-timestamp'] || '');\nconst fresh = /^\\d+$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;  // blocks replayed requests\nconst text = String(body.text || '').trim();\nconst [first = '', ...rest] = text.split(/\\s+/);\n\nreturn [{ json: {\n  base: `v0:${timestamp}:${raw}`,\n  signature: String(headers['x-slack-signature'] || ''),\n  fresh,\n  command: first.toLowerCase(),\n  args: rest.join(' ').trim(),\n  user_id: body.user_id || '',\n  user_name: body.user_name || '',\n  channel_id: body.channel_id || '',\n  response_url: body.response_url || ''\n} }];\n" }, position: [220, 300] },
  output: [{ base: 'v0:1:x', signature: 'v0=abc', fresh: true, command: 'ask', args: 'q', user_id: 'U1', response_url: 'https://hooks.slack.com/x' }]
});
const signRequest = node({
  type: 'n8n-nodes-base.crypto',
  version: 1,
  config: { name: 'Sign Request', parameters: { action: 'hmac', type: 'SHA256', value: expr('{{ $json.base }}'), dataPropertyName: 'expected', secret: 'PASTE_SLACK_SIGNING_SECRET_HERE', encoding: 'hex' }, position: [440, 300] },
  output: [{ expected: 'abc', signature: 'v0=abc', fresh: true }]
});
const isFromSlack = ifElse({
  version: 2.2,
  config: {
    name: 'Really From Slack?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr("{{ $json.fresh && ('v0=' + $json.expected) === $json.signature }}"), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [660, 300]
  }
});
const rejectRequest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Reject Request', parameters: { respondWith: 'json', responseBody: expr("{{ JSON.stringify({ text: \"Request could not be verified as coming from Slack.\" }) }}"), options: { responseCode: 401 } }, position: [880, 520] }
});
const getCategories = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Categories', executeOnce: true, parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '4KeWqQ88qv3lJNV5', cachedResultName: 'category_config' }, returnAll: true }, position: [880, 200] },
  output: [{ category_key: 'area_rug', display_name: 'Area Rug', patterns: 'area rug', active: true }]
});
const routeCommand = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Route Command', parameters: { jsCode: "// Route Command: decide what to do and what to say within Slack's 3-second limit.\nconst req = $('Read Slack Request').first().json;\nconst categories = $input.all().map(i => i.json).filter(c => c.category_key && c.active !== false);\nconst names = categories.map(c => c.display_name.toLowerCase()).join(', ');\nconst HELP = [\n  '*Rug Intel* commands:',\n  '\u2022 `/rug-intel deep-dive <category> focus: <topic>`: full competitor deep dive (about 7 minutes), e.g. `/rug-intel deep-dive outdoor rug focus: weather resistant`',\n  '\u2022 `/rug-intel ask <question>`: quick answer from stored listings, e.g. `/rug-intel ask which Walmart area rugs under $50 rate best?`',\n  '\u2022 `/rug-intel status`: the last agent runs and their trust verdicts',\n  `Categories: ${names}. Dashboard: https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard`\n].join('\\n');\n\nconst out = { route: 'reply_now', response_type: 'ephemeral', text: HELP, chat_input: '', question: '' };\nif (['deep-dive', 'deepdive', 'dive'].includes(req.command)) {\n  const lower = req.args.toLowerCase();\n  const cat = categories.find(c => String(c.patterns || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean)\n    .concat([c.display_name.toLowerCase(), c.category_key]).some(p => lower.includes(p)));\n  if (!cat) {\n    out.text = `I couldn't find a category in \"${req.args || '(nothing)'}\". Try one of: ${names}.\\n\\n${HELP}`;\n  } else {\n    const focus = (req.args.match(/focus\\s*:\\s*(.+)$/i) || [])[1] || '';\n    Object.assign(out, {\n      route: 'deep_dive', response_type: 'in_channel',\n      text: `:mag: <@${req.user_id}> started a *${cat.display_name}* deep dive${focus ? ` (focus: ${focus})` : ''}. It takes about 7 minutes; the findings will post here.`,\n      chat_input: `${cat.display_name}${focus ? '\\nfocus: ' + focus : ''}`\n    });\n  }\n} else if (req.command === 'ask') {\n  if (req.args) Object.assign(out, { route: 'ask', response_type: 'in_channel', text: `:speech_balloon: <@${req.user_id}> asked: _${req.args}_\\nLooking it up...`, question: req.args });\n  else out.text = 'Add a question after `ask`.\\n\\n' + HELP;\n} else if (req.command === 'status') {\n  Object.assign(out, { route: 'status', response_type: 'ephemeral', text: '' });\n}\nreturn [{ json: out }];\n" }, position: [1100, 200] },
  output: [{ route: 'ask', response_type: 'in_channel', text: 'ack', chat_input: '', question: 'q' }]
});
const whichCommand = switchCase({
  version: 3.2,
  config: {
    name: 'Which Command?',
    parameters: {
      rules: {
        values: [
          { outputKey: 'deep_dive', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'deep_dive', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
          { outputKey: 'ask', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'ask', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } },
          { outputKey: 'status', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('{{ $json.route }}'), rightValue: 'status', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Help' }
    },
    position: [1320, 200]
  }
});

const ackDeepDive = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Ack Deep Dive', parameters: { respondWith: 'json', responseBody: expr("{{ JSON.stringify({ response_type: $json.response_type, text: $json.text }) }}"), options: {} }, position: [1560, 0] }
});
const runDeepDive = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Run Deep Dive (Phase 3 v2)',
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once', source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'AjaQorgLqUA6y4fu', cachedResultName: 'Phase 3 - Competitor Monitoring Agent v2' },
      workflowInputs: { mappingMode: 'defineBelow', value: { chatInput: expr("{{ $('Route Command').first().json.chat_input }}") }, matchingColumns: [], schema: [{ id: 'chatInput', displayName: 'chatInput', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }], attemptToConvertTypes: false, convertFieldsToString: true },
      options: { waitForSubWorkflow: true }
    },
    position: [1780, 0]
  },
  output: [{ run_id: '92', category: 'Area Rug', report_url: 'https://x', trust_slack_text: 'ok' }]
});
const formatDeepDive = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Deep Dive', parameters: { jsCode: "// Format Deep Dive: turn the Phase 3 v2 run summary into a Slack message.\nconst r = $input.first().json;\nconst req = $('Read Slack Request').first().json;\nlet text;\nif (r.error || !r.run_id) {\n  text = `:x: The deep dive did not produce a report: ${r.output || 'no result returned'}`;\n} else {\n  const prices = (r.price_lines || []).map(l => {\n    const m = l.match(/^(\\w+) price: avg ([\\d.]+), median ([\\d.]+), min ([\\d.]+), max ([\\d.]+) \\((\\d+) listings\\)/);\n    return m ? `\u2022 ${m[1]}: avg $${Number(m[2]).toFixed(2)}, range $${Number(m[4]).toFixed(2)}\u2013$${Number(m[5]).toFixed(2)} (${m[6]} listings)` : `\u2022 ${l}`;\n  });\n  text = [\n    `*${r.category} deep dive*${r.focus ? ` (focus: ${r.focus})` : ''}, requested by <@${req.user_id}>`,\n    r.key_insight ? `*Key insight:* ${r.key_insight}` : '',\n    prices.length ? '*Prices in this run:*\\n' + prices.join('\\n') : '',\n    r.trust_slack_text,\n    r.status === 'ok' ? '' : `:warning: Run health: degraded (${r.warnings})`,\n    `<${r.report_url}|Open the full report> \u00b7 <https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Dashboard>`\n  ].filter(Boolean).join('\\n\\n');\n}\nreturn [{ json: { text } }];\n" }, position: [2000, 0] },
  output: [{ text: 'summary' }]
});
const postDeepDive = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Post Deep Dive', onError: 'continueRegularOutput', parameters: { method: 'POST', url: expr("{{ $('Read Slack Request').first().json.response_url }}"), sendBody: true, specifyBody: 'json', jsonBody: expr("{{ JSON.stringify({ response_type: 'in_channel', replace_original: false, text: $json.text }) }}"), options: {} }, position: [2220, 0] },
  output: [{ ok: true }]
});

const ackAsk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Ack Question', parameters: { respondWith: 'json', responseBody: expr("{{ JSON.stringify({ response_type: $json.response_type, text: $json.text }) }}"), options: {} }, position: [1560, 200] }
});
const runAsk = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Run Ask Agent',
    onError: 'continueRegularOutput',
    parameters: {
      mode: 'once', source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'AI5A418ZAjCqiyBL', cachedResultName: 'Rug Intel Ask' },
      workflowInputs: { mappingMode: 'defineBelow', value: { question: expr("{{ $('Route Command').first().json.question }}"), asked_by: expr("{{ $('Read Slack Request').first().json.user_name }}") }, matchingColumns: [], schema: [{ id: 'question', displayName: 'question', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'asked_by', displayName: 'asked_by', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }], attemptToConvertTypes: false, convertFieldsToString: true },
      options: { waitForSubWorkflow: true }
    },
    position: [1780, 200]
  },
  output: [{ output: 'answer', question: 'q' }]
});
const formatAsk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Answer', parameters: { jsCode: "// Format Answer: the Q&A agent's answer, already carrying its evidence verdict.\nconst r = $input.first().json;\nconst req = $('Read Slack Request').first().json;\nconst text = r.output ? `*Q (<@${req.user_id}>):* ${r.question || req.args}\\n\\n${r.output}` : ':x: The Q&A agent did not return an answer. Check the Rug Intel Ask executions in n8n.';\nreturn [{ json: { text } }];\n" }, position: [2000, 200] },
  output: [{ text: 'answer' }]
});
const postAnswer = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Post Answer', onError: 'continueRegularOutput', parameters: { method: 'POST', url: expr("{{ $('Read Slack Request').first().json.response_url }}"), sendBody: true, specifyBody: 'json', jsonBody: expr("{{ JSON.stringify({ response_type: 'in_channel', replace_original: false, text: $json.text }) }}"), options: {} }, position: [2220, 200] },
  output: [{ ok: true }]
});

const getRecentRuns = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Get Recent Runs', alwaysOutputData: true, parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'qg3iqSros89SBP5a', cachedResultName: 'agent_runs' }, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC', returnAll: false, limit: 8 }, position: [1560, 400] },
  output: [{ run_id: '92', workflow: 'Phase 3', status: 'ok', trust_verdict: 'review' }]
});
const formatStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Status', parameters: { jsCode: "// Format Status: the last agent runs, so anyone can see whether the agents are healthy.\nconst runs = $input.all().map(i => i.json).filter(r => r && r.run_id).slice(0, 8);\nconst ICON = { ok: ':large_green_circle:', degraded: ':large_yellow_circle:', failed: ':red_circle:' };\nconst VERDICT = { pass: 'PASS', review: 'REVIEW', block: 'BLOCK' };\nconst when = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });\nconst lines = runs.map(r => `${ICON[r.status] || ':white_circle:'} ${when(r.finished_at || r.createdAt)} \u00b7 ${r.workflow} \u00b7 ${r.category_key || ''} \u00b7 trust ${VERDICT[r.trust_verdict] || r.trust_verdict || 'n/a'}${r.warnings ? ` \u00b7 _${String(r.warnings).slice(0, 90)}_` : ''}`);\nconst text = `*Rug Intel: last ${runs.length} runs*\\n${lines.join('\\n') || 'No runs logged yet.'}\\n<https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Open the dashboard>`;\nreturn [{ json: { response_type: 'ephemeral', text } }];\n" }, position: [1780, 400] },
  output: [{ response_type: 'ephemeral', text: 'status' }]
});
const sendStatus = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Status', parameters: { respondWith: 'json', responseBody: expr("{{ JSON.stringify({ response_type: $json.response_type, text: $json.text }) }}"), options: {} }, position: [2000, 400] }
});
const sendHelp = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Send Help', parameters: { respondWith: 'json', responseBody: expr("{{ JSON.stringify({ response_type: $json.response_type, text: $json.text }) }}"), options: {} }, position: [1560, 600] }
});

const note = sticky("## Rug Intel Slack command (beyond the brief)\n`/rug-intel deep-dive <category> focus: <x>` \u00b7 `/rug-intel ask <question>` \u00b7 `/rug-intel status`\n1. **Read Slack Request \u2192 Sign Request \u2192 Really From Slack?** verifies Slack's HMAC signature and rejects replays older than 5 minutes.\n2. Replies within Slack's 3-second limit (**Ack** nodes), then runs the work: Phase 3 v2 for a deep dive (about 7 min) or the Rug Intel Ask agent, and posts the result back to the channel through Slack's `response_url`.\nSetup: paste the app's Signing Secret into **Sign Request** (never commit it). The Request URL is `https://n8n.builtbydhruv.com/webhook/rug-intel/slack` once the workflow is published.", [], { color: 5, width: 620, height: 300, position: [0, -60] });

export default workflow('rug-intel-slack', 'Rug Intel Slack Command')
  .add(slackRequest).to(readRequest).to(signRequest).to(isFromSlack
    .onTrue(getCategories.to(routeCommand).to(whichCommand
      .onCase(0, ackDeepDive.to(runDeepDive).to(formatDeepDive).to(postDeepDive))
      .onCase(1, ackAsk.to(runAsk).to(formatAsk).to(postAnswer))
      .onCase(2, getRecentRuns.to(formatStatus).to(sendStatus))
      .onCase(3, sendHelp)))
    .onFalse(rejectRequest))
  .add(note);
