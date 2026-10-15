// Add Trust Box: put the AI Evidence Check result at the top of the report, so readers see
// how far to trust it before they read it.
const c = $input.first().json;
const trust = $('AI Evidence Check').first().json;
let html = String(c.cleaned_html || '');
const box = trust.trust_html || '';
if (/<main class="report-content">/.test(html)) html = html.replace(/<main class="report-content">/, m => m + box);
else html = html.replace(/<body[^>]*>/i, m => m + box);
return [{ json: { ...c, cleaned_html: html, minified_html: html.replace(/\s+/g, ' '), verdict: trust.verdict } }];
