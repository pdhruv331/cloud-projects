import { workflow, node, trigger, sticky, newCredential, expr } from '@n8n/workflow-sdk';

const onError = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'When an Agent Fails', position: [0, 0] },
  output: [{ execution: { id: '120', url: 'https://n8n.builtbydhruv.com/workflow/x/executions/120', error: { message: 'Mistral 429' }, lastNodeExecuted: 'Comparison Generator', mode: 'webhook' }, workflow: { id: 'x', name: 'Phase 3 - Competitor Monitoring Agent v2' } }]
});
const buildRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Build Failure Row', parameters: { jsCode: "// Build Failure Row: a crashed run still gets a row in agent_runs (status \"failed\"),\n// so the dashboard and /rug-intel status show it instead of it disappearing.\nconst e = $input.first().json;\nconst exec = e.execution || {};\nconst wf = e.workflow || {};\nconst now = new Date().toISOString();\nconst message = String((exec.error && exec.error.message) || 'Unknown error').slice(0, 400);\nreturn [{ json: {\n  run_id: String(exec.id || ''),\n  workflow: wf.name || 'unknown workflow',\n  category_key: '',\n  focus: '',\n  started_at: now,\n  finished_at: now,\n  duration_s: 0,\n  status: 'failed',\n  sections_generated: 0,\n  sections_expected: 0,\n  missing_sections: '',\n  warnings: `failed at \"${exec.lastNodeExecuted || 'unknown node'}\": ${message}`,\n  trust_verdict: 'not checked',\n  _url: exec.url || ''\n} }];\n" }, position: [220, 0] },
  output: [{ run_id: '120', workflow: 'Phase 3', status: 'failed', warnings: 'failed at x', _url: 'https://x' }]
});
const cleanRow = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Table Row', parameters: { jsCode: "// Table Row: drop the helper URL field before saving.\nconst { _url, ...row } = $input.first().json;\nreturn [{ json: row }];\n" }, position: [440, 0] },
  output: [{ run_id: '120', status: 'failed' }]
});
const saveRow = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: { name: 'Save Failed Run', onError: 'continueRegularOutput', parameters: { resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'qg3iqSros89SBP5a', cachedResultName: 'agent_runs' }, columns: { mappingMode: 'autoMapInputData', value: null }, options: {} }, position: [660, 0] },
  output: [{ id: 1 }]
});
const formatAlert = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Format Alert', parameters: { jsCode: "// Format Alert: tell the channel which agent failed, where, and how to open the execution.\nconst r = $('Build Failure Row').first().json;\nconst text = `:red_circle: *${r.workflow}* failed (execution ${r.run_id || 'n/a'}).\\n${r.warnings}` + (r._url ? `\\n<${r._url}|Open the execution in n8n>` : '');\nreturn [{ json: { text } }];\n" }, position: [880, 0] },
  output: [{ text: 'failed' }]
});
const alertSlack = node({
  type: 'n8n-nodes-base.slack',
  version: 2.7,
  config: {
    name: 'Alert Slack',
    onError: 'continueRegularOutput',
    parameters: { resource: 'message', operation: 'post', select: 'channel', channelId: { __rl: true, mode: 'name', value: 'rug-intel' }, messageType: 'text', text: expr('{{ $json.text }}'), otherOptions: { includeLinkToWorkflow: false, unfurl_links: false } },
    credentials: { slackApi: newCredential('Slack Bot (Rug Intel)') },
    position: [1100, 0]
  },
  output: [{ ok: true }]
});
const note = sticky("## Rug Intel Error Handler (beyond the brief)\nSet as the error workflow of every Rug Intel agent. When a production run crashes (not a manual test), it writes a `failed` row to `agent_runs` and alerts #rug-intel with the failing node and a link to the execution. Day 1 only logged runs that finished; this closes that gap.", [], { color: 5, width: 520, height: 200, position: [0, -260] });

export default workflow('rug-intel-error-handler', 'Rug Intel Error Handler')
  .add(onError).to(buildRow).to(cleanRow).to(saveRow).to(formatAlert).to(alertSlack)
  .add(note);
