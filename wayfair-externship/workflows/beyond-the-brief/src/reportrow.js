// Report Row: keep the finished HTML report so Slack and the dashboard can link to it by run_id.
const run = $('Build Run Log').first().json;
return [{
  json: {
    run_id: run.run_id,
    workflow: run.workflow,
    category_key: run.category_key,
    focus: run.focus,
    created_at: run.finished_at,
    verdict: run.trust_verdict,
    html: $('Add Trust Box').first().json.cleaned_html
  }
}];
