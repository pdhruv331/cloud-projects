// Build Dashboard: one page any category team can open, built from the shared tables
// (agent_runs, evidence_checks, competitor_listings, weekly_digests) instead of from report HTML.
const rows = name => $(name).all().map(i => i.json).filter(r => r && r.id !== undefined);
const runs = rows('Get Runs');
const checks = rows('Get Evidence Checks').filter(c => !String(c.run_id).startsWith('test-'));  // hide engine self-tests
const listings = rows('Get Listings');
const config = rows('Get Categories');
const digests = rows('Get Digests');

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '';
const displayName = key => (config.find(c => c.category_key === key) || {}).display_name || String(key || '').replace(/_/g, ' ');
const BASE = 'https://n8n.builtbydhruv.com/webhook/rug-intel';
const VERDICT = { pass: ['PASS', '#059669'], review: ['REVIEW', '#d97706'], block: ['BLOCK', '#dc2626'] };
const pill = (text, color) => `<span class="pill" style="background:${color}1a;color:${color};border-color:${color}55">${esc(text)}</span>`;
const verdictPill = v => VERDICT[v] ? pill(VERDICT[v][0], VERDICT[v][1]) : pill(v || 'not checked', '#6b7280');
const statusPill = s => pill(s || 'unknown', s === 'ok' ? '#059669' : s === 'failed' ? '#dc2626' : '#d97706');

// KPIs over the last 30 days.
const since = Date.now() - 30 * 864e5;
const recent = runs.filter(r => new Date(r.finished_at || r.createdAt).getTime() >= since);
const okShare = recent.length ? Math.round(recent.filter(r => r.status === 'ok').length / recent.length * 100) : 0;
const verdictCounts = { pass: 0, review: 0, block: 0 };
for (const c of checks) if (verdictCounts[c.verdict] !== undefined) verdictCounts[c.verdict]++;

// Price history: average price per retailer per run, by category.
const byRun = {};
for (const l of listings) {
  if (l.price === null || l.price === undefined) continue;
  const k = l.category_key + '|' + l.run_id;
  byRun[k] = byRun[k] || { category: l.category_key, run_id: l.run_id, date: l.run_date, simulated: String(l.run_id).startsWith('sim-'), prices: {} };
  (byRun[k].prices[l.retailer] = byRun[k].prices[l.retailer] || []).push(Number(l.price));
}
const charts = {};
for (const r of Object.values(byRun).sort((a, b) => new Date(a.date) - new Date(b.date))) {
  const c = charts[r.category] = charts[r.category] || { labels: [], series: {} };
  c.labels.push(new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + (r.simulated ? ' (sim)' : ` (run ${r.run_id})`));
  for (const retailer of ['Wayfair', 'Amazon', 'Walmart']) {
    const p = r.prices[retailer] || [];
    (c.series[retailer] = c.series[retailer] || []).push(p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 100) / 100 : null);
  }
}
const chartCats = Object.keys(charts);

// Latest listings per category: where Wayfair sits against each competitor right now.
const latestRun = {};
for (const l of listings) {
  const cur = latestRun[l.category_key];
  if (!cur || new Date(l.run_date) > new Date(cur.date)) latestRun[l.category_key] = { run_id: l.run_id, date: l.run_date };
}
const positionRows = Object.entries(latestRun).map(([cat, lr]) => {
  const items = listings.filter(l => l.category_key === cat && l.run_id === lr.run_id);
  const stat = retailer => {
    const p = items.filter(i => i.retailer === retailer && i.price !== null).map(i => Number(i.price));
    const r = items.filter(i => i.retailer === retailer && i.rating !== null).map(i => Number(i.rating));
    return p.length ? { n: p.length, avg: p.reduce((a, b) => a + b, 0) / p.length, rating: r.length ? r.reduce((a, b) => a + b, 0) / r.length : null } : null;
  };
  const cells = ['Wayfair', 'Amazon', 'Walmart'].map(stat);
  return `<tr><td><strong>${esc(displayName(cat))}</strong><div class="muted">run ${esc(lr.run_id)}, ${fmtDate(lr.date)}</div></td>${cells.map(s => s ? `<td>$${s.avg.toFixed(2)}<div class="muted">${s.n} listings, ${s.rating ? s.rating.toFixed(2) + '★' : 'no rating'}</div></td>` : '<td class="muted">no data</td>').join('')}</tr>`;
}).join('');

// This week's changes: the latest weekly digest per category.
const latestDigest = {};
for (const d of digests) if (!latestDigest[d.category_key] || new Date(d.created_at) > new Date(latestDigest[d.category_key].created_at)) latestDigest[d.category_key] = d;
const digestCards = Object.values(latestDigest).map(d => {
  let det = {};
  try { det = JSON.parse(d.details || '{}'); } catch (e) { det = {}; }
  const money = n => '$' + Number(n).toFixed(2);
  const moves = [...(det.drops || []), ...(det.rises || [])].slice(0, 4).map(m => `<li>${esc(m.retailer)}: ${esc(String(m.name).slice(0, 60))} ${money(m.old)} → ${money(m.now)} (${m.pct > 0 ? '+' : ''}${m.pct}%)</li>`).join('');
  const added = (det.new_listings || []).slice(0, 3).map(n => `<li>New at ${esc(n.retailer)}: ${esc(String(n.name).slice(0, 60))} ${money(n.price)}</li>`).join('');
  return `<div class="kpi" style="text-align:left">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><strong>${esc(displayName(d.category_key))}</strong>${verdictPill(d.verdict)}</div>
    <div class="muted">${fmtDate(d.created_at)}${d.baseline_simulated ? ' · vs simulated baseline' : d.baseline_id ? '' : ' · first snapshot'}</div>
    <div style="margin:6px 0;font-size:.9rem">${d.price_drops} price drops · ${d.price_rises} rises · ${d.new_listings} new · ${d.removed_listings} gone · ${d.rating_moves} rating moves</div>
    ${moves || added ? `<ul style="margin:0 0 0 18px;font-size:.85rem">${moves}${added}</ul>` : '<div class="muted">No changes.</div>'}
  </div>`;
}).join('');

const runRows = runs.slice(0, 15).map(r => {
  const isP3 = /Phase 3/.test(r.workflow || '');
  return `<tr>
    <td>${fmtDate(r.finished_at || r.createdAt)}</td>
    <td>${esc((r.workflow || '').replace(' - ', ': '))}<div class="muted">run ${esc(r.run_id)}</div></td>
    <td>${esc(displayName(r.category_key))}${r.focus ? `<div class="muted">focus: ${esc(r.focus)}</div>` : ''}</td>
    <td>${statusPill(r.status)}${r.warnings ? `<div class="muted">${esc(r.warnings)}</div>` : ''}</td>
    <td>${r.sections_expected ? `${r.sections_generated ?? 0} / ${r.sections_expected}` : ''}</td>
    <td>${verdictPill(r.trust_verdict)}</td>
    <td>${r.duration_s ? Math.round(r.duration_s / 60 * 10) / 10 + ' min' : ''}</td>
    <td>${isP3 && r.status !== 'failed' ? `<a href="${BASE}/report?run=${encodeURIComponent(r.run_id)}" target="_blank">open</a>` : ''}</td>
  </tr>`;
}).join('');

const checkRows = checks.slice(0, 10).map(c => `<tr>
  <td>${fmtDate(c.checked_at || c.createdAt)}</td>
  <td>${esc((c.workflow || '').replace(' - ', ': '))}<div class="muted">run ${esc(c.run_id)}</div></td>
  <td>${verdictPill(c.verdict)}</td>
  <td>${c.numbers_found ?? 0} / ${c.numbers_checked ?? 0}${c.unsupported_numbers ? `<div class="muted">not found: ${esc(c.unsupported_numbers)}</div>` : ''}</td>
  <td>${c.claims_checked ? `${c.claims_checked - (c.claims_unsupported || 0)} / ${c.claims_checked}` : esc(c.ai_check || '')}</td>
  <td class="summary">${esc(c.summary)}</td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rug Intel Dashboard</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
  :root { --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; --bg:#f6f4f8; --card:#fff; --brand:#7B2D8E; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--ink); line-height:1.5; }
  header { background:linear-gradient(135deg,#7B2D8E,#4c1660); color:#fff; padding:28px 32px; }
  header h1 { font-size:1.6rem; } header p { opacity:.85; font-size:.95rem; }
  main { max-width:1200px; margin:0 auto; padding:24px 16px 48px; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:22px; }
  .kpi, .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 18px; }
  .kpi .v { font-size:1.7rem; font-weight:700; color:var(--brand); } .kpi .l { color:var(--muted); font-size:.85rem; }
  .card { margin-bottom:20px; } .card h2 { font-size:1.1rem; margin-bottom:4px; } .card > p { color:var(--muted); font-size:.88rem; margin-bottom:12px; }
  .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:16px; }
  table { width:100%; border-collapse:collapse; font-size:.88rem; } th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.03em; }
  .scroll { overflow-x:auto; } .muted { color:var(--muted); font-size:.78rem; } td.summary { max-width:380px; }
  .pill { display:inline-block; padding:1px 9px; border-radius:999px; font-size:.75rem; font-weight:700; border:1px solid; white-space:nowrap; }
  a { color:var(--brand); }
  footer { color:var(--muted); font-size:.8rem; text-align:center; margin-top:10px; }
</style></head>
<body>
<header><h1>Rug Intel: category health</h1><p>Live from the shared data tables. Updated ${fmtDate(new Date().toISOString())} ET. Every agent run, its trust verdict and the competitor listings it collected.</p></header>
<main>
  <div class="kpis">
    <div class="kpi"><div class="v">${recent.length}</div><div class="l">agent runs, last 30 days</div></div>
    <div class="kpi"><div class="v">${okShare}%</div><div class="l">runs with full output (status ok)</div></div>
    <div class="kpi"><div class="v">${verdictCounts.pass} · ${verdictCounts.review} · ${verdictCounts.block}</div><div class="l">evidence checks: pass · review · block</div></div>
    <div class="kpi"><div class="v">${listings.length}</div><div class="l">competitor listings stored</div></div>
  </div>

  <section class="card"><h2>Where Wayfair sits today</h2><p>Average price and rating per retailer from each category's latest run.</p>
    <div class="scroll"><table><tr><th>Category</th><th>Wayfair</th><th>Amazon</th><th>Walmart</th></tr>${positionRows || '<tr><td colspan="4" class="muted">No listings yet.</td></tr>'}</table></div></section>

  <section class="card"><h2>What changed this week</h2><p>From the Monday digest: full listing pool compared product by product with the previous week. The AI summary's trust verdict is shown per category.</p>
    <div class="kpis" style="margin:0">${digestCards || '<p class="muted">No weekly digest yet.</p>'}</div></section>

  <section class="card"><h2>Average price by deep-dive run</h2><p>One point per deep-dive run. Each run analyzes a 10-listing sample per retailer, so averages move with the sample; week-over-week price moves on the same products are in the weekly digest above.</p>
    <div class="charts">${chartCats.map((c, i) => `<div><h3 style="font-size:.95rem;margin-bottom:6px">${esc(displayName(c))}</h3><canvas id="chart${i}" height="220"></canvas></div>`).join('') || '<p class="muted">No listings yet.</p>'}</div></section>

  <section class="card"><h2>Run health</h2><p>Every run logs listings per retailer, sections produced and its trust verdict. "Degraded" means the run finished but something was missing.</p>
    <div class="scroll"><table><tr><th>Finished</th><th>Workflow</th><th>Category</th><th>Status</th><th>Sections</th><th>Trust</th><th>Time</th><th>Report</th></tr>${runRows || '<tr><td colspan="8" class="muted">No runs yet.</td></tr>'}</table></div></section>

  <section class="card"><h2>AI Evidence Check</h2><p>Numbers traced to the source data, and claims re-checked by a second AI pass, before anyone acts on the output.</p>
    <div class="scroll"><table><tr><th>Checked</th><th>Workflow</th><th>Verdict</th><th>Numbers found</th><th>Claims supported</th><th>Summary</th></tr>${checkRows || '<tr><td colspan="6" class="muted">No checks yet.</td></tr>'}</table></div></section>
  <footer>Prototype on n8n Data Tables. In production these tables live in BigQuery and this page in Looker.</footer>
</main>
<script>
const CHARTS = ${JSON.stringify(charts).replace(/</g, '\\u003c')};
const COLORS = { Wayfair: '#7B2D8E', Amazon: '#f59e0b', Walmart: '#2563eb' };
if (window.Chart) Object.keys(CHARTS).forEach((cat, i) => {
  const c = CHARTS[cat];
  new Chart(document.getElementById('chart' + i), {
    type: 'line',
    data: { labels: c.labels, datasets: Object.keys(c.series).map(r => ({ label: r, data: c.series[r], borderColor: COLORS[r], backgroundColor: COLORS[r], tension: .2, spanGaps: true })) },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => '$' + v } } } }
  });
});
</script>
</body></html>`;

return [{ json: { html } }];
