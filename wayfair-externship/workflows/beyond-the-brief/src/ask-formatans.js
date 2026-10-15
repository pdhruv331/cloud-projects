// Format Answer: the answer, its evidence verdict, and any citation that points at a listing that doesn't exist.
const ctx = $('Build Context').first().json;
const trust = $('AI Evidence Check').first().json;
const answer = String($('Answer Agent').first().json.output || '').replace(/\*\*/g, '*').replace(/^#+\s*/gm, '').trim();
const cited = [...new Set((answer.match(/\b[A-Z]{2}-[WAM]\d+\b/g) || []))];
const unknown = cited.filter(id => !ctx.valid_ids.includes(id));
const notes = [trust.slack_text];
if (!cited.length) notes.push(':grey_question: The answer cites no listing IDs, so check it against the dashboard.');
if (unknown.length) notes.push(`:warning: Cites listings that do not exist: ${unknown.join(', ')}.`);
const output = `${answer}\n\n${notes.join('\n')}\n_Data: ${ctx.datasets}._`;
return [{ json: { output, answer, verdict: unknown.length && trust.verdict === 'pass' ? 'review' : trust.verdict, cited, unknown_citations: unknown, question: ctx.question } }];
