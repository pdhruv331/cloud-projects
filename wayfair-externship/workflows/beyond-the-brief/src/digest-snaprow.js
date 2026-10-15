// Clean Rows: drop helper fields (_warnings, _edits) before saving.
return $input.all().map(i => { const { _warnings, _edits, ...row } = i.json; return { json: row }; });
