// Build Run Log: one row per run in agent_runs, the same table Phase 3 v2 writes to.
const form = $('Extract Files').first().json;
const parsed = $('Parse Content').first().json;
const trust = $('AI Evidence Check').first().json;
const c = parsed.content || {};
const startedAt = $('Upload Form').first().json.submittedAt || new Date().toISOString();
const finishedAt = new Date();

const SECTIONS = { executive_summary: 'Executive summary', key_metrics: 'Key metrics', data_foundation: 'Data foundation', content_ideas: 'Content ideas',
  social_captions: 'Social captions', campaigns: 'Campaigns', email_subjects: 'Email subjects', competitive_angles: 'Competitive angles', content_priorities: 'Content priorities' };
const missing = Object.keys(SECTIONS).filter(k => !c[k] || (Array.isArray(c[k]) && !c[k].length));
const warnings = missing.length ? ['missing sections: ' + missing.map(k => SECTIONS[k]).join(', ')] : [];

return [{
  json: {
    run_id: String($execution.id),
    workflow: 'Phase 4 - Content Strategy Generator v4',
    category_key: String(form.category || '').toLowerCase().replace(/\s+/g, '_'),
    focus: form.focus || '',
    started_at: startedAt,
    finished_at: finishedAt.toISOString(),
    duration_s: Math.max(0, Math.round((finishedAt - new Date(startedAt)) / 1000)),
    status: warnings.length ? 'degraded' : 'ok',
    sections_generated: Object.keys(SECTIONS).length - missing.length,
    sections_expected: Object.keys(SECTIONS).length,
    missing_sections: missing.map(k => SECTIONS[k]).join(', '),
    warnings: warnings.join('; '),
    trust_verdict: trust.verdict
  }
}];
