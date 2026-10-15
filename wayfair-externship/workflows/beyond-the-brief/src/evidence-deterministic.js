// Deterministic Checks: audit AI output against its source data without trusting the AI.
// Checks every number, banned phrases, past years, reused example lines and non-answers,
// then picks up to 12 factual sentences for the AI claim-support step.
const input = $input.first().json;
const toArray = v => Array.isArray(v) ? v : (typeof v === 'string' && v.trim() ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch (e) { return v.split('\n'); } })() : []);

const stripHtml = s => String(s || '')
  .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'")
  .replace(/```[a-z]*|```/gi, ' ')
  .replace(/\*\*|__/g, '')
  .replace(/\s+/g, ' ').trim();

// Sections: [{name, text}]. A single ai_text is treated as one section.
let sections = toArray(input.sections).filter(s => s && typeof s === 'object');
if (!sections.length) sections = [{ name: 'Output', text: input.ai_text || '' }];
sections = sections.map(s => ({ name: String(s.name || 'Section'), text: stripHtml(s.text) }));
const aiText = sections.map(s => s.text).join('\n');

const sourceRaw = stripHtml(input.source_text);
const sourceText = sourceRaw.replace(/,(?=\d{3})/g, '');
const derived = toArray(input.derived_numbers).map(Number).filter(n => Number.isFinite(n));

// 1. Non-answers: a section that is nearly empty or is a refusal / classifier label, not analysis.
const REFUSAL = /^(user safety|safe|unsafe)\b|\bI (?:can't|cannot|am unable to|'m unable to) (?:help|assist|provide|complete)|\bas an AI (?:language )?model\b|^I'm sorry/i;
const nonAnswers = sections
  .filter(s => s.text.length < Number(input.min_section_chars || 200) || REFUSAL.test(s.text.slice(0, 200)))
  .map(s => ({ section: s.name, length: s.text.length, starts_with: s.text.slice(0, 80) }));

// 2. Numbers: each must appear in the source exactly, or match a statistic computed from it (within rounding).
const scrubbed = aiText
  .replace(/\b\d+(?:\.\d+)?\s?(?:'|ft|feet|foot)?\s?[x×]\s?\d+(?:\.\d+)?\s?(?:'|ft|feet|foot|in)?\b/gi, ' ')  // rug sizes like 8x10, 5' x 7'
  .replace(/\b(?:19|20)\d{2}\b/g, ' ');                                                               // years are checked separately
const NUMBER = /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\b\d+\.\d+\b|\b\d{1,3}(?:,\d{3})+\b|\b\d{2,}\b/g;
const valueOf = n => parseFloat(n.replace(/[$,%]/g, ''));
// Round dollar amounts ($50, $100, $300...) are price bands or targets, not facts about a listing.
const isThreshold = n => n.startsWith('$') && !n.includes('.') && valueOf(n) >= 50 && valueOf(n) % 50 === 0;
const found = [...new Set((scrubbed.match(NUMBER) || []).map(n => n.replace(/\s/g, '')))];
const thresholdsSkipped = found.filter(isThreshold);
const numbers = found.filter(n => !isThreshold(n));
// A whole number that is a real source value rounded or cut off ($29 for $29.99) counts as found.
const sourceValues = (sourceText.match(/\d+\.\d+/g) || []).map(Number);
const inSource = n => {
  const core = n.replace(/[$,%]/g, '');
  return new RegExp('(^|[^\\d.])' + core.replace('.', '\\.') + '(?![\\d]|\\.\\d)').test(sourceText);
};
const nearDerived = n => {
  const v = valueOf(n);
  // Whole numbers may be rounded; a number written to the cent must match to the cent.
  const decimals = (n.split('.')[1] || '').replace(/\D/g, '').length;
  const tolerance = d => decimals === 0 ? Math.max(0.5, Math.abs(d) * 0.01) : 0.6 / Math.pow(10, decimals);
  if (derived.some(d => Math.abs(v - d) <= tolerance(d))) return true;
  return Number.isInteger(v) && sourceValues.some(s => Math.floor(s) === v || Math.round(s) === v);
};
const unsupportedNumbers = numbers.filter(n => !inSource(n) && !nearDerived(n));

// 3. Banned phrases (brand voice), reused example lines, past years.
const DEFAULT_BANNED = ['elevate', 'elevated', 'curated', 'curation', 'seamless', 'seamlessly', 'timeless elegance',
  'must-have', 'game-changer', 'unlock', 'transform your space', 'fast-paced world', 'look no further',
  'stunning', 'shop now', 'buy now', "don't miss out", 'link in bio'];
const banned = toArray(input.banned_phrases).length ? toArray(input.banned_phrases) : (input.check_brand_voice ? DEFAULT_BANNED : []);
const fullAi = sections.map(s => s.text).join(' ');
const bannedPhrases = banned
  .map(phrase => ({ phrase, count: (fullAi.match(new RegExp('\\b' + String(phrase).replace(/[-'.*+?^${}()|[\]\\]/g, m => '\\' + m) + 's?\\b', 'gi')) || []).length }))
  .filter(b => b.count > 0);

const lowerAi = fullAi.toLowerCase().replace(/[‘’]/g, "'");
const reusedExamples = toArray(input.example_lines).filter(line => line && lowerAi.includes(String(line).toLowerCase()));

const thisYear = new Date().getFullYear();
const pastYears = input.check_past_years
  ? [...new Set((fullAi.match(/\b(?:19|20)\d{2}\b/g) || []).filter(y => Number(y) < thisYear && !sourceText.includes(y)))]
  : [];

// 4. Claims for the AI step: sentences with a number or a comparison (the ones most likely to be wrong),
//    spread across sections so one long section doesn't use up the 12 slots.
const CLAIMY = /\d|cheaper|pricier|higher|lower|more|fewer|most|least|only|leads?|dominat|outperform|lacks?|gap|best|worst/i;
const splitSentences = t => t.split(/(?<!\b(?:avg|e\.g|i\.e|vs|approx|est))(?<=[.!?])\s+(?=[A-Z"'$])/).map(x => x.trim());
const perSection = Math.max(2, Math.ceil(12 / Math.max(1, sections.length - nonAnswers.length)));
const claims = [];
for (const s of sections) {
  const candidates = [...new Set(splitSentences(s.text))].filter(x => x.length >= 40 && x.length <= 320 && CLAIMY.test(x));
  candidates.sort((a, b) => /\d/.test(b) - /\d/.test(a));
  claims.push(...candidates.slice(0, perSection));
}
claims.splice(12);

const sourceTooThin = sourceRaw.length < 300;

return [{
  json: {
    run_id: String(input.run_id || ''),
    workflow: String(input.workflow || ''),
    category_key: String(input.category_key || ''),
    sections_checked: sections.length,
    source_chars: sourceRaw.length,
    source_too_thin: sourceTooThin,
    non_answers: nonAnswers,
    numbers_checked: numbers.length,
    thresholds_skipped: thresholdsSkipped,
    numbers_found: numbers.length - unsupportedNumbers.length,
    unsupported_numbers: unsupportedNumbers,
    banned_phrases: bannedPhrases,
    reused_examples: reusedExamples,
    past_years: pastYears,
    claims,
    claim_prompt: [
      'SOURCE DATA:', sourceRaw.slice(0, 30000),
      input.derived_summary ? '\nSTATISTICS COMPUTED FROM THE SOURCE DATA:\n' + input.derived_summary : '',
      '\nCLAIMS TO CHECK:', claims.map((c, i) => `${i + 1}. ${c}`).join('\n')
    ].join('\n')
  }
}];
