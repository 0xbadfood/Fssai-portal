#!/usr/bin/env node
// Checks the portal's intake graph before release (the lab ran the same checks, plus source quotes):
//   1. the graph validates (conditions, concepts, licence rules, bands, documents)
//   2. every scenario case in scripts/intake/cases.v<N>.json passes
//   3. every tap path ends in a sensible verdict and the graph's invariants hold (skip with --quick)
// Usage: node scripts/intake/check.mjs [--quick] [--graph config/intake/graph.vN.json]   (default: the one in config/intake/intake.json)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createEngine, loadGraph, validateGraph } from '../../server/intake/engine/index.js'
import { runCases } from './cases.js'
import { walkAll } from './walk.js'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const args = process.argv.slice(2)
const configured = `config/intake/${JSON.parse(readFileSync(path.join(root, 'config/intake/intake.json'), 'utf8')).graph}`
const graphFile = path.resolve(root, args.includes('--graph') ? args[args.indexOf('--graph') + 1] : configured)
const graph = loadGraph(graphFile)
let bad = 0

const problems = validateGraph(graph)
console.log(`graph ${path.relative(root, graphFile)} (v${graph.version}): ${problems.length ? `${problems.length} problem(s)` : 'valid'}`)
for (const p of problems) console.error(' -', p)
bad += problems.length
const E = createEngine(graph)

const { cases } = JSON.parse(readFileSync(path.join(root, `scripts/intake/cases.v${graph.version}.json`), 'utf8'))
const results = runCases(E, cases)
for (const r of results.filter((x) => x.problems.length)) {
  console.error(`✖ ${r.name}`)
  for (const p of r.problems) console.error(`    - ${p}`)
}
const failed = results.filter((r) => r.problems.length).length
console.log(`cases: ${results.length - failed}/${results.length} pass`)
bad += failed

if (!args.includes('--quick')) {
  // Same limits as the lab: every pair of activities, every pair of kinds for one activity (~3 min).
  const maxPick = graph.verdict?.model === 'kob' ? (q, f) => (q.id === 'activity' ? 2 : (f.activities || []).length > 1 ? 1 : 2) : null
  const t0 = Date.now()
  const w = walkAll(E, E, { maxPick })
  console.log(`paths: ${w.paths} in ${((Date.now() - t0) / 1000).toFixed(0)}s`, w.verdicts)
  for (const x of w.failures.slice(0, 40)) console.error(' -', x)
  bad += w.failures.length
}
console.log(bad ? `\n${bad} problem(s)` : '\nall OK')
process.exit(bad ? 1 : 0)
