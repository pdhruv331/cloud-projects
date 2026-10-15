// Digest Rows: one row per category for the weekly_digests table (feeds the dashboard).
const facts = $('Compare Weeks').first().json;
const ai = String($('Digest Writer').first().json.output || '').trim();
const verdict = $('AI Evidence Check').first().json.verdict;
const createdAt = new Date().toISOString();
return facts.categories.map(c => ({ json: {
  digest_id: 'digest-' + $execution.id,
  created_at: createdAt,
  category_key: c.category_key,
  baseline_id: c.baseline_id,
  baseline_simulated: c.baseline_simulated,
  price_drops: c.drops.length,
  price_rises: c.rises.length,
  new_listings: c.new_listings.length,
  removed_listings: c.removed.length,
  rating_moves: c.rating_moves.length,
  details: JSON.stringify({ drops: c.drops, rises: c.rises, new_listings: c.new_listings, removed: c.removed, rating_moves: c.rating_moves, avg_prices: c.avg_prices }),
  ai_summary: ai,
  verdict
} }));
