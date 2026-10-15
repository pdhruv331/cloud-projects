// Build Run Log: the digest logs to agent_runs like the other agents.
const facts = $('Compare Weeks').first().json;
const snap = $('Take Snapshot').first().json;
const trust = $('AI Evidence Check').first().json;
const posted = $('Post to Slack').first().json;
const warnings = [];
if (snap._warnings) warnings.push(snap._warnings);
if (!posted || posted.ok === false || posted.error) warnings.push('Slack post failed: ' + (posted.error && posted.error.message || posted.error || 'no response'));
const now = new Date().toISOString();
return [{ json: {
  run_id: String($execution.id),
  workflow: 'Rug Intel Weekly Digest',
  category_key: facts.categories.map(c => c.category_key).join(','),
  focus: 'weekly change digest',
  started_at: snap.snapshot_date,
  finished_at: now,
  duration_s: Math.round((new Date(now) - new Date(snap.snapshot_date)) / 1000),
  status: warnings.length ? 'degraded' : 'ok',
  sections_generated: facts.categories.length,
  sections_expected: facts.categories.length,
  warnings: warnings.join('; '),
  trust_verdict: trust.verdict
} }];
