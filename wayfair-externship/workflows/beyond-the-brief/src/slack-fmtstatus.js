// Format Status: the last agent runs, so anyone can see whether the agents are healthy.
const runs = $input.all().map(i => i.json).filter(r => r && r.run_id).slice(0, 8);
const ICON = { ok: ':large_green_circle:', degraded: ':large_yellow_circle:', failed: ':red_circle:' };
const VERDICT = { pass: 'PASS', review: 'REVIEW', block: 'BLOCK' };
const when = d => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
const lines = runs.map(r => `${ICON[r.status] || ':white_circle:'} ${when(r.finished_at || r.createdAt)} · ${r.workflow} · ${r.category_key || ''} · trust ${VERDICT[r.trust_verdict] || r.trust_verdict || 'n/a'}${r.warnings ? ` · _${String(r.warnings).slice(0, 90)}_` : ''}`);
const text = `*Rug Intel: last ${runs.length} runs*\n${lines.join('\n') || 'No runs logged yet.'}\n<https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Open the dashboard>`;
return [{ json: { response_type: 'ephemeral', text } }];
