// Find Report: return the stored HTML report for ?run=<run_id>, or a short "not found" page.
const run = String(($('Report Request').first().json.query || {}).run || '');
const row = $input.all().map(i => i.json).find(r => r && r.html && String(r.run_id) === run);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = row ? row.html : `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report not found</title></head>
<body style="font-family:sans-serif;max-width:640px;margin:60px auto;padding:0 16px;color:#1f2937">
<h1 style="font-size:1.4rem">No report for run ${esc(run || '(none)')}</h1>
<p>Reports are kept for Phase 3 v2 runs. Open the <a href="https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard">Rug Intel dashboard</a> to see recent runs.</p></body></html>`;
return [{ json: { html, status: row ? 200 : 404 } }];
