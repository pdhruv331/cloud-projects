// Parse Input: extract the rug category (and optional "focus:" line) from chat or from another workflow.
// Categories come from the category_config table, so a team can add or rename one without editing this workflow.
let input = '';
for (const trigger of ['When chat message received', 'When Called by Another Workflow']) {
  try { input = $(trigger).first().json.chatInput || input; } catch (e) { /* that trigger did not run */ }
}

const categories = $input.all().map(i => i.json)
  .filter(c => c.category_key && c.active !== false)
  .map(c => ({
    key: c.category_key,
    display: c.display_name,
    patterns: String(c.patterns || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean),
    minListings: Number(c.min_listings || 10),
    notes: c.analyst_notes || ''
  }));
if (!categories.length) throw new Error('category_config has no active categories. Add at least one row with active = true.');

const lowerInput = input.toLowerCase();
let match = null;
for (const cat of categories) {
  if (cat.patterns.some(p => lowerInput.includes(p)) || lowerInput.includes(cat.key)) { match = cat; break; }
}

const focusMatch = input.match(/focus\s*:\s*([^\n]+)/i);
const focus = focusMatch ? focusMatch[1].trim() : '';

return [{
  json: {
    selectedCategory: match ? match.display : null,
    categoryDisplayName: match ? match.display : null,
    categoryKey: match ? match.key : null,
    focus,
    minListings: match ? match.minListings : 10,
    analystNotes: match ? match.notes : '',
    availableCategories: categories.map(c => c.display),
    hasValidInput: !!match,
    errorReason: match ? null : 'no_category'
  }
}];
