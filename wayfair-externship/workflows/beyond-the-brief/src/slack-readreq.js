// Read Slack Request: rebuild the exact string Slack signed ("v0:<timestamp>:<raw body>") and read the command.
// Slack docs: https://api.slack.com/authentication/verifying-requests-from-slack
const item = $input.first();
const headers = item.json.headers || {};
const body = item.json.body || {};
let raw = '';
if (item.binary && item.binary.data) raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');
// Fallback if the raw body was not kept: re-encode the parsed form the way Slack sends it.
const enc = v => encodeURIComponent(String(v)).replace(/%20/g, '+').replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
if (!raw) raw = Object.entries(body).map(([k, v]) => enc(k) + '=' + enc(v)).join('&');

const timestamp = String(headers['x-slack-request-timestamp'] || '');
const fresh = /^\d+$/.test(timestamp) && Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;  // blocks replayed requests
const text = String(body.text || '').trim();
const [first = '', ...rest] = text.split(/\s+/);

return [{ json: {
  base: `v0:${timestamp}:${raw}`,
  signature: String(headers['x-slack-signature'] || ''),
  fresh,
  command: first.toLowerCase(),
  args: rest.join(' ').trim(),
  user_id: body.user_id || '',
  user_name: body.user_name || '',
  channel_id: body.channel_id || '',
  response_url: body.response_url || ''
} }];
