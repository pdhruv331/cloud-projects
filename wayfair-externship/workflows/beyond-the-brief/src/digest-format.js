// Format Slack Message: deterministic numbers first (from the comparison), then the AI's
// act / watch summary with its evidence verdict, so nobody acts on an unchecked sentence.
const facts = $('Compare Weeks').first().json;
const ai = String($('Digest Writer').first().json.output || '').replace(/\*\*/g, '*').replace(/^#+\s*/gm, '').trim();
const trust = $('AI Evidence Check').first().json;
const money = n => '$' + Number(n).toFixed(2);
const short = s => String(s).length > 70 ? String(s).slice(0, 67) + '...' : String(s);
const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

const parts = [`*:bar_chart: Rug Intel weekly digest, ${week}*`];
for (const c of facts.categories) {
  const lines = [`\n*${c.display_name}*` + (c.baseline_id ? ` vs ${String(c.baseline_date).slice(0, 10)}` : ' (first snapshot)') + (c.baseline_simulated ? ' _(simulated baseline for the demo)_' : '')];
  const ap = c.avg_prices;
  lines.push('Avg price: ' + ['Wayfair', 'Amazon', 'Walmart'].map(r => `${r} ${ap[r].current !== null ? money(ap[r].current) : 'n/a'}`).join(' · '));
  for (const m of c.drops.slice(0, 5)) lines.push(`:small_red_triangle_down: ${m.retailer} <${m.url}|${short(m.name)}> ${money(m.old)} → ${money(m.now)} (${m.pct}%)`);
  for (const m of c.rises.slice(0, 3)) lines.push(`:small_red_triangle: ${m.retailer} <${m.url}|${short(m.name)}> ${money(m.old)} → ${money(m.now)} (+${m.pct}%)`);
  if (c.new_listings.length) lines.push(`:new: ${c.new_listings.length} new: ` + c.new_listings.slice(0, 4).map(n => `${n.retailer} <${n.url}|${short(n.name)}> ${money(n.price)}`).join('; '));
  if (c.removed.length) lines.push(`:wastebasket: ${c.removed.length} gone: ` + c.removed.slice(0, 4).map(n => `${n.retailer} ${short(n.name)}`).join('; '));
  if (c.rating_moves.length) lines.push(':star: Rating moves: ' + c.rating_moves.slice(0, 3).map(m => `${m.retailer} ${short(m.name)} ${m.old} → ${m.now}`).join('; '));
  if (!c.has_changes) lines.push(c.baseline_id ? `No price moves of ${c.threshold}%+ and no new or removed listings.` : 'Baseline recorded; changes show from next week.');
  parts.push(lines.join('\n'));
}
parts.push(`\n*What it means* (AI summary, ${trust.slack_text.replace(/^\S+\s/, '').replace(/\*/g, '')})\n${ai}`);
parts.push(`\n<https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard|Open the dashboard> · Ask a follow-up with \`/rug-intel ask ...\``);

return [{ json: { text: parts.join('\n'), verdict: trust.verdict } }];
