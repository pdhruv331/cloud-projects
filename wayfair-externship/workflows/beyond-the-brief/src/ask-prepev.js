// Prepare Evidence Check: the answer may only use the listings and statistics it was given.
const ctx = $('Build Context').first().json;
return [{ json: {
  run_id: String($execution.id),
  workflow: 'Rug Intel Ask',
  category_key: ctx.categories,
  sections: [{ name: 'Answer', text: String($input.first().json.output || '') }],
  source_text: ctx.context_text,
  derived_numbers: ctx.derived_numbers,
  min_section_chars: 40,
  check_brand_voice: false,
  check_past_years: false
} }];
