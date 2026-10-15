// Error Response: explain in chat why no report was produced.
const input = $input.first().json;
const reason = input.errorReason || 'unknown';
const available = (input.availableCategories || []).join(', ');

let message;
if (reason === 'no_category') {
  message = 'I could not detect a rug category. Send one of: ' + available + '. Optionally add a second line such as "focus: washable".';
} else if (reason === 'missing_retailer_data') {
  message = 'No report was generated: the product API returned no usable products for ' + (input.missingRetailers || []).join(', ') +
    '. A competitor comparison needs Wayfair, Amazon and Walmart data. Try again in a few minutes.';
} else {
  message = 'An unknown error occurred. Check the execution log in n8n.';
}

return [{ json: { error: true, reason, output: message } }];
