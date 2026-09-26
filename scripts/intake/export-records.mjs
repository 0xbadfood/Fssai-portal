#!/usr/bin/env node
// Reviewed answer records from the lab -> config/intake/records.v<N>.jsonl (only what matching needs).
// Only model-reviewed records outside the test split ship; the test split stays in the lab for evaluation.
// Records from versions the graph declares compatible (same questions and options) are included.
// Usage: node scripts/intake/export-records.mjs LAB_DIR VERSION
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [lab, version = '2'] = process.argv.slice(2)
const files = JSON.parse(readFileSync(path.join(lab, 'testbed/config.json'), 'utf8')).records
const graph = JSON.parse(readFileSync(path.join(lab, `graph/graph.v${version}.json`), 'utf8'))
const versions = new Set([version, ...(graph.compatibleWith || []).map(String)])
const out = []
for (const f of files) {
  for (const line of readFileSync(path.join(lab, f), 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line)
    if (r.status !== 'model-reviewed' || r.split === 'test' || !versions.has(String(r.graph_version))) continue
    out.push(JSON.stringify({ id: r.id.slice(0, 16), step: r.step, text_norm: r.text_norm, token_sig: r.token_sig, targets: r.targets }))
  }
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
writeFileSync(path.join(root, `config/intake/records.v${version}.jsonl`), out.join('\n') + '\n')
console.log(`records.v${version}.jsonl: ${out.length} records from ${files.length} file(s)`)
