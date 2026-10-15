// Build Run Log: Q&A answers are logged like every other agent run.
const q = $('Read Question').first().json;
const f = $('Format Answer').first().json;
const ctx = $('Build Context').first().json;
const now = new Date();
const warnings = [];
if (f.unknown_citations.length) warnings.push('unknown citations: ' + f.unknown_citations.join(', '));
if (!f.cited.length) warnings.push('no citations');
return [{ json: {
  run_id: String($execution.id),
  workflow: 'Rug Intel Ask',
  category_key: ctx.categories,
  focus: q.question.slice(0, 200),
  started_at: q.started_at,
  finished_at: now.toISOString(),
  duration_s: Math.round((now - new Date(q.started_at)) / 1000),
  status: warnings.length ? 'degraded' : 'ok',
  sections_generated: 1,
  sections_expected: 1,
  warnings: warnings.join('; '),
  trust_verdict: f.verdict
} }];
