// Build Context: pick the categories the question is about and give the agent their latest listings,
// each with a short ID it must cite (AR-W3 = Area Rug, Wayfair, listing 3), plus computed statistics.
const q = $('Read Question').first().json.question;
const rows = name => $(name).all().map(i => i.json).filter(r => r && r.id !== undefined);
const config = rows('Get Categories').filter(c => c.active !== false);
const snapshots = rows('Get Snapshots').filter(r => r.simulated !== true);
const runs = rows('Get Run Listings');

const lower = q.toLowerCase();
const mentioned = config.filter(c => String(c.patterns || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
  .concat([String(c.display_name || '').toLowerCase(), c.category_key]).some(p => p && lower.includes(p)));
const ABBR = { area_rug: 'AR', outdoor_rug: 'OR', hallway_runner: 'HR', shag_rug: 'SR' };
const LETTER = { Wayfair: 'W', Amazon: 'A', Walmart: 'M' };

const latest = (list, idField, dateField, key) => {
  const forCat = list.filter(r => r.category_key === key);
  if (!forCat.length) return null;
  const newest = forCat.reduce((a, b) => new Date(b[dateField]) > new Date(a[dateField]) ? b : a);
  return { id: newest[idField], date: newest[dateField], rows: forCat.filter(r => r[idField] === newest[idField]) };
};

const stats = vals => {
  const v = vals.filter(x => x !== null && x !== undefined).map(Number).sort((a, b) => a - b);
  if (!v.length) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  const mid = Math.floor(v.length / 2);
  const r2 = n => Math.round(n * 100) / 100;
  return { n: v.length, avg: r2(sum / v.length), median: v.length % 2 ? v[mid] : r2((v[mid - 1] + v[mid]) / 2), min: v[0], max: v[v.length - 1] };
};

const blocks = [];
const derived = [];
const ids = [];
const datasets = [];
for (const cat of (mentioned.length ? mentioned : config)) {
  const snap = latest(snapshots, 'snapshot_id', 'snapshot_date', cat.category_key);
  const run = latest(runs, 'run_id', 'run_date', cat.category_key);
  const use = snap || run;
  if (!use) continue;
  const label = snap ? `weekly snapshot of ${String(snap.date).slice(0, 10)}, full listing pool` : `deep-dive run ${run.id} of ${String(run.date).slice(0, 10)}, 10-listing sample per retailer`;
  datasets.push(`${cat.display_name}: ${label} (${use.rows.length} listings)`);
  const lines = [`CATEGORY ${cat.display_name} (source: ${label})`];
  const counters = {};
  const listingLines = [];
  for (const retailer of ['Wayfair', 'Amazon', 'Walmart']) {
    const items = use.rows.filter(r => r.retailer === retailer).sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
    const p = stats(items.map(i => i.price));
    const r = stats(items.map(i => i.rating));
    if (p) {
      lines.push(`STATS ${retailer}: ${p.n} listings, price avg $${p.avg}, median $${p.median}, min $${p.min}, max $${p.max}` + (r ? `; rating avg ${r.avg}, min ${r.min}, max ${r.max}` : ''));
      derived.push(p.n, p.avg, p.median, p.min, p.max);
      if (r) derived.push(r.avg, r.min, r.max);
      derived.push(items.filter(i => i.price < 50).length, items.filter(i => i.price < 100).length);
    }
    for (const it of items) {
      counters[retailer] = (counters[retailer] || 0) + 1;
      const id = `${ABBR[cat.category_key] || cat.category_key.slice(0, 2).toUpperCase()}-${LETTER[retailer]}${counters[retailer]}`;
      ids.push(id);
      listingLines.push(`${id} | ${retailer} | ${String(it.product_name).slice(0, 110)} | ${it.price !== null ? '$' + it.price : 'no price'} | ${it.rating ?? 'no rating'} stars | ${it.review_count ?? 0} reviews`);
    }
  }
  lines.push('LISTINGS (ID | retailer | product | price | rating | reviews), cheapest first:', ...listingLines);
  blocks.push(lines.join('\n'));
}
if (!blocks.length) throw new Error('No listings are stored yet. Run a deep dive or the weekly digest first.');

return [{ json: {
  question: q,
  context_text: blocks.join('\n\n'),
  derived_numbers: derived,
  valid_ids: ids,
  datasets: datasets.join('; '),
  categories: (mentioned.length ? mentioned : config).map(c => c.category_key).join(',')
} }];
