// Take Snapshot: record the full listing pool (not a 10-item sample) for every category with
// weekly_digest = true, so next week can be compared product by product.
const cats = $input.all().map(i => i.json).filter(c => c.category_key && c.active !== false && c.weekly_digest === true);
if (!cats.length) throw new Error('No categories have weekly_digest = true in category_config, so there is nothing to snapshot.');

const snapshotId = 'snap-' + $execution.id;
const snapshotDate = new Date().toISOString();
const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const rows = [];
const warnings = [];
for (const cat of cats) {
  for (const retailer of ['wayfair', 'amazon', 'walmart']) {
    try {
      const res = await this.helpers.httpRequest({
        method: 'GET',
        url: `http://34.196.186.128:8000/api/products/${retailer}`,
        qs: { category: cat.category_key, limit: 50 },
        json: true,
        timeout: 30000
      });
      for (const p of res.products || []) {
        rows.push({ json: {
          snapshot_id: snapshotId, snapshot_date: snapshotDate, category_key: cat.category_key,
          retailer: retailer.charAt(0).toUpperCase() + retailer.slice(1),
          product_name: String(p.name || '').slice(0, 300), product_url: p.url || '',
          price: num(p.price), rating: num(p.rating), review_count: num(p.review_count), simulated: false
        } });
      }
    } catch (e) {
      warnings.push(`${cat.display_name} / ${retailer}: ${e.message}`);
    }
  }
}
if (!rows.length) throw new Error('The product API returned no listings for any digest category. ' + warnings.join('; '));
rows[0].json._warnings = warnings.join('; ');
return rows;
