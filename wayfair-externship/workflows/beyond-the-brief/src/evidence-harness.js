// Runs n8n Code-node source locally: node harness.js <code.js> <nodes.json> <input.json|-> [execId]
const fs = require('fs');
const [, , codeFile, nodesFile, inputFile, execId] = process.argv;
const nodes = nodesFile && nodesFile !== '-' ? JSON.parse(fs.readFileSync(nodesFile, 'utf8')) : {};
const inputJson = inputFile && inputFile !== '-' ? JSON.parse(fs.readFileSync(inputFile, 'utf8')) : {};
const $ = name => {
  if (!(name in nodes)) throw new Error('Node not run: ' + name);
  return { first: () => ({ json: nodes[name] }), all: () => [{ json: nodes[name] }] };
};
const $input = { first: () => ({ json: inputJson }), all: () => (Array.isArray(inputJson) ? inputJson.map(j => ({ json: j })) : [{ json: inputJson }]) };
const $execution = { id: execId || '90' };
const code = fs.readFileSync(codeFile, 'utf8');
const fn = new Function('$', '$input', '$execution', 'return (async () => {' + code + '\n})();');
fn($, $input, $execution).then(r => console.log(JSON.stringify(r[0].json, null, 1))).catch(e => { console.error('ERROR', e.message); process.exit(1); });
