// Format Deep Dive: turn the Phase 3 v2 run summary into a Slack message.
const r = $input.first().json;
const req = $('Read Slack Request').first().json;
let text;
if (r.error || !r.run_id) {
  text = `:x: The deep dive did not produce a report: ${r.output || 'no result returned'}`;
} else {
  const prices = (r.price_lines || []).map(l => {
    const m = l.match(/^(\w+) price: avg ([\d.]+), median ([\d.]+), min ([\d.]+), max ([\d.]+) \((\d+) listings\)/);
    return m ? `• ${m[1]}: avg $${Number(m[2]).toFixed(2)}, range $${Number(m[4]).toFixed(2)}–$${Number(m[5]).toFixed(2)} (${m[6]} listings)` : `• ${l}`;
  });
  text = [
    `*${r.category} deep dive*${r.focus ? ` (focus: ${r.focus})` : ''}, requested by <@${req.user_id}>`,
    r.key_insight ? `*Key insight:* ${r.key_insight}` : '',
    prices.length ? '*Prices in this run:*\n' + prices.join('\n') : '',
    r.trust_slack_text,
    r.status === 'ok' ? '' : `:warning: Run health: degraded (${r.warnings})`,
    `<${r.report_url}|Open the full report> · <https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Dashboard>`
  ].filter(Boolean).join('\n\n');
}
return [{ json: { text } }];
