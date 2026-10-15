// Prepare Evidence Check: send the content plan and the two reports it was written from
// to the shared AI Evidence Check (numbers, brand voice, past years, reused lines, AI claim check).
const parsed = $('Parse Content').first().json;
const form = $('Extract Files').first().json;
const c = parsed.content || {};
const text = v => Array.isArray(v) ? v.map(text).join(' ') : (v && typeof v === 'object' ? Object.values(v).map(text).join(' ') : String(v ?? ''));
const sentence = s => { const t = String(s || '').trim(); return t && !/[.!?]$/.test(t) ? t + '.' : t; };
const lines = arr => (arr || []).map(x => sentence(text(x))).join(' ');

const sections = [
  { name: 'Executive Summary', text: sentence(c.executive_summary) + ' ' + lines((c.key_metrics || []).map(m => `${m.label}: ${m.value}`)) },
  { name: 'Data Foundation', text: lines((c.data_foundation || {}).p2_insights) + ' ' + lines((c.data_foundation || {}).p3_insights) },
  { name: 'Content Ideas', text: lines((c.content_ideas || []).map(i => [i.title, i.description, i.data_connection])) },
  { name: 'Social Captions', text: lines(Object.values(c.social_captions || {}).flat()) },
  { name: 'Campaigns', text: lines((c.campaigns || []).map(x => [x.name, x.tagline, x.description, x.details])) },
  { name: 'Emails, Angles and Priorities', text: lines((c.email_subjects || []).map(e => e.subject)) + ' ' + lines(c.competitive_angles) + ' ' + lines((c.content_priorities || []).map(p => [p.title, p.rationale])) }
];

return [{
  json: {
    run_id: String($execution.id),
    workflow: 'Phase 4 - Content Strategy Generator v4',
    category_key: String(form.category || '').toLowerCase().replace(/\s+/g, '_'),
    sections,
    source_text: 'P2 MARKET ANALYSIS: ' + form.p2_content + '\n\nP3 COMPETITOR ANALYSIS: ' + form.p3_content,
    min_section_chars: 80,
    check_brand_voice: true,
    check_past_years: true,
    example_lines: ['cozy floors start here', 'soft enough for movie nights', 'that rug your friend has', 'nowhere to be', 'chance of staying in']
  }
}];
