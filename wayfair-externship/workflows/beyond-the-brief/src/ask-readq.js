// Read Question: the same agent answers from Slack (/rug-intel ask) or from the n8n chat.
let question = '';
let askedBy = '';
try { const t = $('When Called by Slack').first().json; question = t.question || ''; askedBy = t.asked_by || ''; } catch (e) { /* not called from Slack */ }
try { question = question || $('Ask in n8n Chat').first().json.chatInput || ''; askedBy = askedBy || 'n8n chat'; } catch (e) { /* not called from chat */ }
question = String(question).trim();
if (!question) throw new Error('No question received. Ask something like: which Walmart area rugs under $50 have the best ratings?');
return [{ json: { question, asked_by: askedBy, started_at: new Date().toISOString() } }];
