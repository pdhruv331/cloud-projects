// Format Answer: the Q&A agent's answer, already carrying its evidence verdict.
const r = $input.first().json;
const req = $('Read Slack Request').first().json;
const text = r.output ? `*Q (<@${req.user_id}>):* ${r.question || req.args}\n\n${r.output}` : ':x: The Q&A agent did not return an answer. Check the Rug Intel Ask executions in n8n.';
return [{ json: { text } }];
