// Prepare Evidence Check: the AI summary may only use facts from the comparison above.
const facts = $('Compare Weeks').first().json;
const text = String($input.first().json.output || '');
const derived = [];
for (const c of facts.categories) {
  for (const m of [...c.drops, ...c.rises]) derived.push(m.old, m.now, m.pct, Math.abs(m.pct), Math.round((m.now - m.old) * 100) / 100, Math.abs(Math.round((m.now - m.old) * 100) / 100));
  for (const a of Object.values(c.avg_prices)) if (a.current !== null && a.previous !== null) derived.push(Math.round((a.current - a.previous) * 100) / 100);
  derived.push(c.drops.length, c.rises.length, c.new_listings.length, c.removed.length, c.rating_moves.length);
}
return [{ json: {
  run_id: String($execution.id),
  workflow: 'Rug Intel Weekly Digest',
  category_key: facts.categories.map(c => c.category_key).join(','),
  sections: [{ name: 'Digest summary', text }],
  source_text: facts.facts_text,
  derived_numbers: derived,
  min_section_chars: 60,
  check_brand_voice: false,
  check_past_years: false
} }];
