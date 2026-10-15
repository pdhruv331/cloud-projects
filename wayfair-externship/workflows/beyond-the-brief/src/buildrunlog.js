// Build Run Log: one row per run in agent_runs, so a run that "succeeds" with thin output
// is visible (status "degraded") instead of passing silently.
const parsed = $('Input Parser').first().json;
const startedAt = $('Record Listings').first().json.run_date;
const finishedAt = new Date();
let trustVerdict = '';
try { trustVerdict = $('AI Evidence Check').first().json.verdict || ''; } catch (e) { trustVerdict = 'not checked'; }

const count = (nodeName, field) => ($(nodeName).first().json[field] || []).length;
const listings = {
  wayfair: count('Reshape Wayfair Response', 'wayfair_products'),
  amazon: count('Reshape Amazon Response', 'amazonProducts'),
  walmart: count('Reshape Walmart Response', 'walmartProducts')
};

// A section counts as generated only if its agent returned real content.
const SECTIONS = ['Executive Summary Generator', 'Amazon Analysis Generator', 'Comparison Generator',
  'Pricing & Whitespace Generator', 'Recommendations Generator', 'Supplier Identification Generator'];
const missing = SECTIONS.filter(name => {
  try { return String($(name).first().json.output || '').trim().length < 200; }
  catch (e) { return true; }
});

const warnings = [];
for (const [retailer, n] of Object.entries(listings)) {
  if (n === 0) warnings.push(`no ${retailer} listings`);
  else if (n < 10) warnings.push(`only ${n} ${retailer} listings`);
}
if (missing.length) warnings.push(`missing sections: ${missing.map(s => s.replace(' Generator', '')).join(', ')}`);

return [{
  json: {
    run_id: String($execution.id),
    workflow: 'Phase 3 - Competitor Monitoring Agent v2',
    category_key: parsed.categoryKey,
    focus: parsed.focus || '',
    started_at: startedAt,
    finished_at: finishedAt.toISOString(),
    duration_s: Math.round((finishedAt - new Date(startedAt)) / 1000),
    status: warnings.length ? 'degraded' : 'ok',
    wayfair_listings: listings.wayfair,
    amazon_listings: listings.amazon,
    walmart_listings: listings.walmart,
    sections_generated: SECTIONS.length - missing.length,
    sections_expected: SECTIONS.length,
    missing_sections: missing.map(s => s.replace(' Generator', '')).join(', '),
    warnings: warnings.join('; '),
    trust_verdict: trustVerdict
  }
}];
