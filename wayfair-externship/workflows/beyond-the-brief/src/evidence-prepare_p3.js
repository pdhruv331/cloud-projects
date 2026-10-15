// Prepare Evidence Check: hand the six AI sections and the listing data they were written from
// to the shared AI Evidence Check, plus the statistics the agents are allowed to compute
// (averages, medians, ranges, gaps), so a correct average is not flagged as invented.
const parsed = $('Input Parser').first().json;
const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

const RETAILERS = [
  ['Wayfair', 'Reshape Wayfair Response', 'wayfair_products'],
  ['Amazon', 'Reshape Amazon Response', 'amazonProducts'],
  ['Walmart', 'Reshape Walmart Response', 'walmartProducts'],
];
const listings = {};
for (const [retailer, nodeName, field] of RETAILERS) {
  listings[retailer] = ($(nodeName).first().json[field] || []).map(p => ({
    name: p.name, price: num(p.price), rating: num(p.rating), reviews: num(p.review_count)
  }));
}

// Statistics an analyst could fairly derive from the listings.
const derived = [];
const summary = [];
const round2 = n => Math.round(n * 100) / 100;
const stats = vals => {
  const v = vals.filter(x => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const sum = v.reduce((a, b) => a + b, 0);
  const mid = Math.floor(v.length / 2);
  return { count: v.length, sum: round2(sum), avg: round2(sum / v.length), median: v.length % 2 ? v[mid] : round2((v[mid - 1] + v[mid]) / 2), min: v[0], max: v[v.length - 1] };
};
const avgPrice = {};
let allPrices = [];
for (const [retailer, items] of Object.entries(listings)) {
  derived.push(items.length);
  allPrices = allPrices.concat(items.map(i => i.price));
  for (const field of ['price', 'rating', 'reviews']) {
    const s = stats(items.map(i => i[field]));
    if (!s) continue;
    derived.push(s.count, s.sum, s.avg, s.median, s.min, s.max, round2(s.max - s.min));
    summary.push(`${retailer} ${field}: avg ${s.avg}, median ${s.median}, min ${s.min}, max ${s.max} (${s.count} listings)`);
    if (field === 'price') avgPrice[retailer] = s.avg;
  }
}
const all = stats(allPrices);
if (all) derived.push(all.count, all.avg, all.median, all.min, all.max);
// Gaps between retailers' average prices, in dollars and percent, both directions.
const names = Object.keys(avgPrice);
for (const a of names) for (const b of names) {
  if (a === b) continue;
  derived.push(round2(avgPrice[a] - avgPrice[b]), round2(Math.abs(avgPrice[a] - avgPrice[b]) / avgPrice[b] * 100));
}

const SECTIONS = ['Executive Summary', 'Amazon Analysis', 'Comparison', 'Pricing & Whitespace', 'Recommendations', 'Supplier Identification'];
const sections = SECTIONS.map(name => {
  let text = '';
  try { text = String($(name + ' Generator').first().json.output || ''); } catch (e) { text = ''; }
  return { name, text };
});

return [{
  json: {
    run_id: String($execution.id),
    workflow: 'Phase 3 - Competitor Monitoring Agent v2',
    category_key: parsed.categoryKey,
    sections,
    source_text: JSON.stringify(listings),
    derived_numbers: derived,
    derived_summary: summary.join('\n'),
    banned_phrases: [],
    example_lines: [],
    check_past_years: false
  }
}];
