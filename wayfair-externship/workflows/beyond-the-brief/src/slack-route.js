// Route Command: decide what to do and what to say within Slack's 3-second limit.
const req = $('Read Slack Request').first().json;
const categories = $input.all().map(i => i.json).filter(c => c.category_key && c.active !== false);
const names = categories.map(c => c.display_name.toLowerCase()).join(', ');
const HELP = [
  '*Rug Intel* commands:',
  '• `/rug-intel deep-dive <category> focus: <topic>`: full competitor deep dive (about 7 minutes), e.g. `/rug-intel deep-dive outdoor rug focus: weather resistant`',
  '• `/rug-intel ask <question>`: quick answer from stored listings, e.g. `/rug-intel ask which Walmart area rugs under $50 rate best?`',
  '• `/rug-intel status`: the last agent runs and their trust verdicts',
  `Categories: ${names}. Dashboard: https://n8n.builtbydhruv.com/webhook/rug-intel/dashboard`
].join('\n');

const out = { route: 'reply_now', response_type: 'ephemeral', text: HELP, chat_input: '', question: '' };
if (['deep-dive', 'deepdive', 'dive'].includes(req.command)) {
  const lower = req.args.toLowerCase();
  const cat = categories.find(c => String(c.patterns || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean)
    .concat([c.display_name.toLowerCase(), c.category_key]).some(p => lower.includes(p)));
  if (!cat) {
    out.text = `I couldn't find a category in "${req.args || '(nothing)'}". Try one of: ${names}.\n\n${HELP}`;
  } else {
    const focus = (req.args.match(/focus\s*:\s*(.+)$/i) || [])[1] || '';
    Object.assign(out, {
      route: 'deep_dive', response_type: 'in_channel',
      text: `:mag: <@${req.user_id}> started a *${cat.display_name}* deep dive${focus ? ` (focus: ${focus})` : ''}. It takes about 7 minutes; the findings will post here.`,
      chat_input: `${cat.display_name}${focus ? '\nfocus: ' + focus : ''}`
    });
  }
} else if (req.command === 'ask') {
  if (req.args) Object.assign(out, { route: 'ask', response_type: 'in_channel', text: `:speech_balloon: <@${req.user_id}> asked: _${req.args}_\nLooking it up...`, question: req.args });
  else out.text = 'Add a question after `ask`.\n\n' + HELP;
} else if (req.command === 'status') {
  Object.assign(out, { route: 'status', response_type: 'ephemeral', text: '' });
}
return [{ json: out }];
