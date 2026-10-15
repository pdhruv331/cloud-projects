// Run Summary: the short answer a category manager sees in chat or Slack, with a link to the full report.
const run = $('Build Run Log').first().json;
const trust = $('AI Evidence Check').first().json;
const prep = $('Prepare Evidence Check').first().json;
const strip = s => String(s || '').replace(/```[a-z]*|```/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

let keyInsight = '';
try {
  const ex = String($('Executive Summary Generator').first().json.output || '');
  const m = ex.match(/class="key-insight"[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  keyInsight = strip(m ? m[1] : ex).slice(0, 500);
} catch (e) { keyInsight = ''; }

const priceLines = String(prep.derived_summary || '').split('\n').filter(l => / price: /.test(l));
const reportUrl = 'https://n8n.builtbydhruv.com/webhook/rug-intel/report?run=' + encodeURIComponent(run.run_id);
const category = run.category_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const output = [
  `${category} deep dive${run.focus ? ' (focus: ' + run.focus + ')' : ''}, run ${run.run_id}`,
  keyInsight ? 'Key insight: ' + keyInsight : '',
  'Prices: ' + priceLines.join(' | '),
  trust.slack_text.replace(/\*/g, ''),
  run.status === 'ok' ? 'Run health: ok' : 'Run health: degraded (' + run.warnings + ')',
  'Full report: ' + reportUrl
].filter(Boolean).join('\n\n');

return [{
  json: {
    output,
    run_id: run.run_id,
    category_key: run.category_key,
    category,
    focus: run.focus,
    status: run.status,
    warnings: run.warnings,
    verdict: trust.verdict,
    trust_summary: trust.summary,
    trust_slack_text: trust.slack_text,
    key_insight: keyInsight,
    price_lines: priceLines,
    report_url: reportUrl
  }
}];
