// Table Row: keep only the evidence_checks columns (the HTML and Slack text go back to the caller, not the table).
const v = $input.first().json;
const COLUMNS = ['run_id', 'workflow', 'category_key', 'checked_at', 'verdict', 'numbers_checked', 'numbers_found',
  'unsupported_numbers', 'non_answers', 'banned_phrases', 'past_years', 'reused_examples', 'claims_checked',
  'claims_unsupported', 'unsupported_claims', 'ai_check', 'summary'];
const row = {};
for (const c of COLUMNS) row[c] = v[c];
return [{ json: row }];
