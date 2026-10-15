// Compare Weeks: product-by-product changes between this snapshot and the previous one
// for each digest category. Thresholds come from category_config (price_move_pct).
const snapshotId = $('Take Snapshot').first().json.snapshot_id;
const cats = $('Digest Categories').all().map(i => i.json).filter(c => c.category_key && c.active !== false && c.weekly_digest === true);
const history = $input.all().map(i => i.json).filter(r => r && r.snapshot_id);
const money = n => '$' + Number(n).toFixed(2);
const round1 = n => Math.round(n * 10) / 10;

const categories = [];
const factLines = [];
for (const cat of cats) {
  const rows = history.filter(r => r.category_key === cat.category_key);
  const cur = rows.filter(r => r.snapshot_id === snapshotId);
  const prevDates = {};
  for (const r of rows) if (r.snapshot_id !== snapshotId) prevDates[r.snapshot_id] = r.snapshot_date;
  const baselineId = Object.keys(prevDates).sort((a, b) => new Date(prevDates[b]) - new Date(prevDates[a]))[0];
  const prev = rows.filter(r => r.snapshot_id === baselineId);
  const simulated = prev.some(r => r.simulated === true);
  const key = r => r.retailer + '|' + r.product_url;
  const prevMap = Object.fromEntries(prev.map(r => [key(r), r]));
  const curMap = Object.fromEntries(cur.map(r => [key(r), r]));
  const threshold = Number(cat.price_move_pct || 5);

  const priceMoves = [];
  const ratingMoves = [];
  for (const [k, c] of Object.entries(curMap)) {
    const p = prevMap[k];
    if (!p) continue;
    if (p.price && c.price && p.price !== c.price) {
      const pct = (c.price - p.price) / p.price * 100;
      if (Math.abs(pct) >= threshold) priceMoves.push({ retailer: c.retailer, name: c.product_name, url: c.product_url, old: p.price, now: c.price, pct: round1(pct) });
    }
    if (p.rating && c.rating && Math.abs(c.rating - p.rating) >= 0.2) ratingMoves.push({ retailer: c.retailer, name: c.product_name, old: p.rating, now: c.rating });
  }
  const newListings = baselineId ? cur.filter(r => !prevMap[key(r)]).map(r => ({ retailer: r.retailer, name: r.product_name, url: r.product_url, price: r.price })) : [];
  const removed = baselineId ? prev.filter(r => !curMap[key(r)]).map(r => ({ retailer: r.retailer, name: r.product_name, price: r.price })) : [];

  const avg = (list, retailer) => { const p = list.filter(r => r.retailer === retailer && r.price).map(r => r.price); return p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length * 100) / 100 : null; };
  const avgPrices = {};
  for (const r of ['Wayfair', 'Amazon', 'Walmart']) avgPrices[r] = { previous: avg(prev, r), current: avg(cur, r), listings: cur.filter(x => x.retailer === r).length };

  const drops = priceMoves.filter(m => m.pct < 0).sort((a, b) => a.pct - b.pct);
  const rises = priceMoves.filter(m => m.pct > 0).sort((a, b) => b.pct - a.pct);
  const c = {
    category_key: cat.category_key, display_name: cat.display_name, owner_team: cat.owner_team || '',
    baseline_id: baselineId || '', baseline_date: prevDates[baselineId] || '', baseline_simulated: simulated,
    threshold, drops, rises, new_listings: newListings, removed, rating_moves: ratingMoves, avg_prices: avgPrices,
    has_changes: !!(priceMoves.length || newListings.length || removed.length || ratingMoves.length)
  };
  categories.push(c);

  factLines.push(`CATEGORY: ${cat.display_name}` + (baselineId ? ` (compared with snapshot of ${String(c.baseline_date).slice(0, 10)}${simulated ? ', a SIMULATED baseline' : ''})` : ' (first snapshot, no baseline yet)'));
  for (const [r, a] of Object.entries(avgPrices)) factLines.push(`- ${r}: ${a.listings} listings, average price ${a.current !== null ? money(a.current) : 'n/a'}${a.previous !== null ? ' (was ' + money(a.previous) + ')' : ''}`);
  for (const m of drops) factLines.push(`- PRICE DROP ${m.retailer}: "${m.name}" ${money(m.old)} -> ${money(m.now)} (${m.pct}%)`);
  for (const m of rises) factLines.push(`- PRICE RISE ${m.retailer}: "${m.name}" ${money(m.old)} -> ${money(m.now)} (+${m.pct}%)`);
  for (const n of newListings) factLines.push(`- NEW LISTING ${n.retailer}: "${n.name}" at ${money(n.price)}`);
  for (const n of removed) factLines.push(`- REMOVED ${n.retailer}: "${n.name}" (was ${money(n.price)})`);
  for (const m of ratingMoves) factLines.push(`- RATING ${m.retailer}: "${m.name}" ${m.old} -> ${m.now}`);
  if (!c.has_changes) factLines.push(baselineId ? '- No price moves of ' + threshold + '% or more, no new or removed listings, no rating moves.' : '- Baseline recorded this week; changes will show from next week.');
  factLines.push('');
}

return [{ json: { snapshot_id: snapshotId, categories, facts_text: factLines.join('\n'), any_changes: categories.some(c => c.has_changes) } }];
