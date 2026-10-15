// Build Simulated Baseline (DEMO ONLY): the sample API returns fixed prices, so a real week-over-week
// change never happens. This writes last week's Area Rug snapshot as a copy of today's pool with
// a few documented edits, flagged simulated = true, so the digest has something to show.
// Edits: two Amazon prices were 15% and 12% higher, one Wayfair price was 10% lower,
// one Walmart rating was 0.3 higher, and two Walmart listings did not exist yet.
const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const pools = {};
for (const retailer of ['wayfair', 'amazon', 'walmart']) {
  const res = await this.helpers.httpRequest({ method: 'GET', url: `http://34.196.186.128:8000/api/products/${retailer}`, qs: { category: 'area_rug', limit: 50 }, json: true, timeout: 30000 });
  pools[retailer] = (res.products || []).slice().sort((a, b) => String(a.url).localeCompare(String(b.url)));
}
if (pools.amazon.length < 4 || pools.wayfair.length < 3 || pools.walmart.length < 10) throw new Error('The product API returned too few listings to build the simulated baseline.');

const edits = [];
const row = (retailer, p) => ({
  snapshot_id: 'sim-baseline-area_rug', snapshot_date: new Date(Date.now() - 7 * 864e5).toISOString(), category_key: 'area_rug',
  retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1), product_name: String(p.name || '').slice(0, 300), product_url: p.url,
  price: num(p.price), rating: num(p.rating), review_count: num(p.review_count), simulated: true
});
const rows = [];
for (const [retailer, list] of Object.entries(pools)) {
  list.forEach((p, i) => {
    if (retailer === 'walmart' && (i === 5 || i === 9)) { edits.push(`left out ${p.name.slice(0, 40)} (Walmart) so it shows as new`); return; }
    const r = row(retailer, p);
    if (retailer === 'amazon' && i === 0) { r.price = Math.round(r.price * 1.15 * 100) / 100; edits.push(`Amazon ${p.name.slice(0, 40)} was ${r.price}`); }
    if (retailer === 'amazon' && i === 3) { r.price = Math.round(r.price * 1.12 * 100) / 100; edits.push(`Amazon ${p.name.slice(0, 40)} was ${r.price}`); }
    if (retailer === 'wayfair' && i === 2) { r.price = Math.round(r.price * 0.9 * 100) / 100; edits.push(`Wayfair ${p.name.slice(0, 40)} was ${r.price}`); }
    if (retailer === 'walmart' && i === 1 && r.rating) { r.rating = Math.min(5, Math.round((r.rating + 0.3) * 10) / 10); edits.push(`Walmart ${p.name.slice(0, 40)} rating was ${r.rating}`); }
    rows.push({ json: r });
  });
}
rows[0].json._edits = edits.join('; ');
return rows;
