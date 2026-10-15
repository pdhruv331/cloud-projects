// Verdict: combine the rule checks and the AI claim check into pass / review / block,
// and render the same result as an HTML Trust box (reports) and a short text (Slack).
const d = $('Deterministic Checks').first().json;

// AI claim check (optional): a JSON list of {id, verdict, reason}. If it failed, say so instead of guessing.
let claimResults = [];
let aiCheck = 'skipped (no factual claims found)';
if (d.claims.length) {
  aiCheck = 'unavailable (the AI check did not return a usable answer)';
  try {
    const raw = String($('Claim Support Check').first().json.output || '').replace(/```json|```/g, '');
    // Take the first complete JSON array only: models sometimes repeat their answer.
    const start = raw.indexOf('[');
    let depth = 0, inString = false, end = -1;
    for (let i = start; start >= 0 && i < raw.length; i++) {
      const ch = raw[i];
      if (inString) { if (ch === '\\') i++; else if (ch === '"') inString = false; continue; }
      if (ch === '"') inString = true;
      else if (ch === '[') depth++;
      else if (ch === ']' && --depth === 0) { end = i; break; }
    }
    if (end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      claimResults = parsed
        .filter(r => r && Number.isInteger(Number(r.id)) && d.claims[Number(r.id) - 1])
        .map(r => {
          let verdict = String(r.verdict || 'unclear').toLowerCase();
          const reason = String(r.reason || '').slice(0, 300);
          // A recommendation or opinion is not a factual claim, whatever label the checker gave it.
          if (verdict === 'unsupported' && /recommendation|opinion|not a factual|suggestion|advice/i.test(reason)) verdict = 'unclear';
          return { claim: d.claims[Number(r.id) - 1], verdict, reason };
        });
      if (claimResults.length) aiCheck = 'done';
    }
  } catch (e) { /* keep "unavailable" */ }
}
const unsupportedClaims = claimResults.filter(r => r.verdict === 'unsupported');

// Verdict rules (deliberately simple so a category manager can follow them):
//  block  - only rule-based checks can block: no usable source data, a non-answer section,
//           or fewer than 60% of numbers traceable. The AI claim check is a second opinion
//           that can send a report to review, never block it on its own.
//  review - anything else flagged
//  pass   - nothing flagged
const reasons = [];
let verdict = 'pass';
const numberShare = d.numbers_checked ? d.numbers_found / d.numbers_checked : 1;
if (d.source_too_thin) reasons.push('the source data is almost empty, so nothing can be verified');
for (const n of d.non_answers) reasons.push(`"${n.section}" is not a real answer (${n.length} characters: "${n.starts_with}")`);
if (d.numbers_checked >= 5 && numberShare < 0.6) reasons.push(`only ${d.numbers_found} of ${d.numbers_checked} numbers trace back to the source`);
if (reasons.length) verdict = 'block';

const flags = [];
if (d.unsupported_numbers.length) flags.push(`${d.unsupported_numbers.length} number(s) not found in the source: ${d.unsupported_numbers.join(', ')}`);
if (unsupportedClaims.length) flags.push(`${unsupportedClaims.length} of ${claimResults.length} checked claims not supported (AI second opinion)`);
if (d.banned_phrases.length) flags.push('banned phrases: ' + d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '));
if (d.past_years.length) flags.push('past years: ' + d.past_years.join(', '));
if (d.reused_examples.length) flags.push('reused example lines: ' + d.reused_examples.join(', '));
if (verdict === 'pass' && flags.length) verdict = 'review';

const LABEL = { pass: 'PASS', review: 'REVIEW', block: 'BLOCK' };
const ICON = { pass: '✅', review: '⚠️', block: '⛔' };
const summary = verdict === 'pass'
  ? `All ${d.numbers_checked} numbers trace back to the source and nothing was flagged.`
  : verdict === 'review'
    ? `Usable, but check before sharing: ${flags.join('; ')}.`
    : `Do not share as is: ${reasons.join('; ')}.${flags.length ? ' Also: ' + flags.join('; ') + '.' : ''}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const COLOR = { pass: '#059669', review: '#d97706', block: '#dc2626' };
const li = (label, value) => `<li style="margin:4px 0"><strong>${label}:</strong> ${value}</li>`;
const trustHtml = `
<section class="trust-check" style="margin:0 0 2rem;padding:1.25rem 1.5rem;border:1px solid #e5e7eb;border-left:6px solid ${COLOR[verdict]};border-radius:8px;background:#fff">
  <h2 style="border:none;margin:0 0 .5rem;font-size:1.3rem">${ICON[verdict]} AI Evidence Check: ${LABEL[verdict]}</h2>
  <p style="margin:0 0 .75rem;color:#374151">${esc(summary)}</p>
  <ul style="margin:0 0 0 1.2rem;color:#374151">
    ${li('Numbers', `${d.numbers_found} of ${d.numbers_checked} found in the source data or computed from it${d.unsupported_numbers.length ? '. Not found: ' + esc(d.unsupported_numbers.join(', ')) : ''}`)}
    ${li('Sections', d.non_answers.length ? 'non-answers: ' + esc(d.non_answers.map(n => n.section).join(', ')) : `all ${d.sections_checked} contain real content`)}
    ${li('Claims (AI check)', aiCheck === 'done' ? `${claimResults.length - unsupportedClaims.length} of ${claimResults.length} supported` : esc(aiCheck))}
    ${unsupportedClaims.length ? li('Unsupported claims', '<ul style="margin:4px 0 0 1.2rem">' + unsupportedClaims.map(c => `<li>${esc(c.claim)}<br><span style="color:#6b7280">${esc(c.reason)}</span></li>`).join('') + '</ul>') : ''}
    ${d.banned_phrases.length ? li('Banned phrases', esc(d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '))) : ''}
    ${d.past_years.length ? li('Past years', esc(d.past_years.join(', '))) : ''}
    ${d.reused_examples.length ? li('Reused example lines', esc(d.reused_examples.join(', '))) : ''}
  </ul>
  <p style="margin:.75rem 0 0;font-size:.85rem;color:#6b7280">Checked automatically: every number against the source data (exact, or a statistic computed from it), every section for a real answer, and up to 12 factual sentences by a second AI pass. Only the rule-based checks can block; the AI pass can only send a report to review. A pass means traceable, not necessarily right.</p>
</section>`;

const slackText = `${ICON[verdict]} *Evidence check: ${LABEL[verdict]}*. ${summary}`;

return [{
  json: {
    run_id: d.run_id,
    workflow: d.workflow,
    category_key: d.category_key,
    checked_at: new Date().toISOString(),
    verdict,
    numbers_checked: d.numbers_checked,
    numbers_found: d.numbers_found,
    unsupported_numbers: d.unsupported_numbers.join(', '),
    non_answers: d.non_answers.map(n => n.section).join(', '),
    banned_phrases: d.banned_phrases.map(b => `${b.phrase} (${b.count})`).join(', '),
    past_years: d.past_years.join(', '),
    reused_examples: d.reused_examples.join(', '),
    claims_checked: claimResults.length,
    claims_unsupported: unsupportedClaims.length,
    unsupported_claims: JSON.stringify(unsupportedClaims),
    ai_check: aiCheck,
    summary,
    trust_html: trustHtml,
    slack_text: slackText
  }
}];
