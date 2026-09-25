// Walks every tap path through the intake automaton and checks that each one is sensible and ends in a verdict.
// Run: node scripts/check-intake.mjs [--tree]   (--tree prints the question/option tree with the verdict counts)
import {
  QUESTIONS, applyTap, clearQuestion, divergences, isAnswerValid, isMulti, nextQuestion, optionsFor, reconcile, titleFor,
} from '../src/lib/intakeQuestions.js'
import { eligibilityFromFacts, formKind } from '../src/lib/applicationPlan.js'
import { LICENCE } from '../src/lib/eligibility.js'

const TWO_STATES = ['Maharashtra', 'Karnataka']
const failures = []
const verdicts = {}
const tree = new Map() // "q1=a > q2=b" prefix -> count (only for --tree)
let paths = 0

// Combinations that must never be reachable, whatever the order of answers (independent of the option rules).
const FORBIDDEN = [
  ['street cart for a manufacturer, importer, wholesaler, store or transporter',
    (f) => f.place === 'street' && ((f.activities || []).some((a) => a === 'make' || a === 'import') || (f.trade || []).some((t) => t !== 'retail'))],
  ['home kitchen for an importer, wholesaler, store or transporter',
    (f) => f.place === 'home' && ((f.activities || []).includes('import') || (f.trade || []).some((t) => t !== 'retail'))],
  ['airport/railway outlet for a manufacturer or importer', (f) => f.place === 'hub' && (f.activities || []).some((a) => a === 'make' || a === 'import')],
  ['vehicles-only for anything but a transporter', (f) => f.place === 'vehicles' && !((f.activities || []).join() === 'sell' && (f.trade || []).join() === 'transport')],
  ['vending question outside a street cart', (f) => f.municipal_registered != null && f.place !== 'street'],
  ['several states picked for a single-state business', (f) => f.locations && f.locations !== 'multistate' && (f.states || []).length > 1],
  ['multi-state business with one state', (f) => f.locations === 'multistate' && (f.states || []).length < 2],
  ['trade kinds without selling', (f) => f.trade && !(f.activities || []).includes('sell')],
  ['home kitchen with several places', (f) => f.place === 'home' && f.locations !== 'one'],
]

function subsets(list) {
  const out = []
  for (let m = 1; m < 1 << list.length; m++) out.push(list.filter((_, i) => m & (1 << i)))
  return out
}

function choices(q, f) {
  if (q.kind === 'states') return isMulti(q, f) ? [{ states: TWO_STATES }] : [{ states: [TWO_STATES[0]] }]
  const opts = optionsFor(q, f)
  if (!isMulti(q, f)) return opts.map((o) => ({ optionIds: [o.id] }))
  const normal = opts.filter((o) => !o.exclusive).map((o) => o.id)
  return [...subsets(normal).map((ids) => ({ optionIds: ids })), ...opts.filter((o) => o.exclusive).map((o) => ({ optionIds: [o.id] }))]
}

const label = (q, c) => `${q.id}=${c.states ? (c.states.length > 1 ? '2 states' : '1 state') : c.optionIds.join('+')}`

function walk(facts, trail, seen) {
  const q = nextQuestion(facts)
  if (!q) return finish(facts, trail)
  if (trail.length > QUESTIONS.length * 2) return failures.push(`no end after ${trail.join(' > ')}`)
  const opts = choices(q, facts)
  if (!opts.length) return failures.push(`"${titleFor(q, facts)}" has no options after ${trail.join(' > ')}`)
  for (const c of opts) {
    let next
    try {
      next = applyTap(facts, q, c).facts
    } catch (e) {
      failures.push(`${label(q, c)} rejected (${e.message}) after ${trail.join(' > ')}`)
      continue
    }
    const step = label(q, c)
    // A question may come back only after "None of these" > "back" or a "Just checking" answer that changed
    // something. Walk each such loop once and prune further repeats; any other repeat is a bug.
    const prev = seen.get(q.id)
    if (prev && q.id !== 'check') {
      const reason = trail.slice(prev.at).some((t) => t.startsWith('check=') || t === 'nonfood=back')
      if (!reason) failures.push(`${q.id} asked again after ${trail.join(' > ')}`)
      if (!reason || prev.count >= 2) continue
    }
    if (q.id === 'check' && trail.filter((t) => t.startsWith('check=')).length >= 3) continue
    walk(next, [...trail, step], new Map(seen).set(q.id, { count: (prev?.count || 0) + 1, at: trail.length }))
  }
}

function finish(f, trail) {
  paths++
  const where = trail.join(' > ')
  for (const [name, bad] of FORBIDDEN) if (bad(f)) failures.push(`forbidden (${name}): ${where}`)
  for (const q of QUESTIONS) if (q.relevant(f) && !isAnswerValid(q, f)) failures.push(`invalid ${q.id} answer at end: ${where}`)
  if (divergences(f).length) failures.push(`ends with an open check (${divergences(f)[0].id}): ${where}`)
  if (JSON.stringify(reconcile(f)) !== JSON.stringify(f)) failures.push(`reconcile not stable: ${where}`)
  const e = eligibilityFromFacts(f)
  const ok =
    (e.outcome === 'notfood' && !e.licence) ||
    (e.outcome === 'deemed' && !e.licence) ||
    (Object.values(LICENCE).includes(e.licence) && ['A', 'B'].includes(formKind(e)))
  if (!ok) failures.push(`no verdict (${JSON.stringify(e)}): ${where}`)
  if (e.licence && e.licence !== LICENCE.CENTRAL && (f.importer || f.place === 'hub' || f.ecommerce_platform || (f.states || []).length > 1)) {
    failures.push(`central override missed: ${where}`)
  }
  const key = e.licence || e.outcome
  verdicts[key] = (verdicts[key] || 0) + 1
  if (process.argv.includes('--tree')) for (let i = 1; i <= trail.length; i++) tree.set(trail.slice(0, i).join(' > '), (tree.get(trail.slice(0, i).join(' > ')) || 0) + 1)
  // Changing any earlier answer must lead back into a valid path.
  for (const q of QUESTIONS) {
    if (!q.answered(f) || !q.relevant(f) || q.id === 'check') continue
    const back = reconcile(clearQuestion(f, q.id))
    if (!nextQuestion(back)) failures.push(`changing ${q.id} asks nothing: ${where}`)
  }
}

walk({}, [], new Map())

console.log(`paths: ${paths}`)
console.log('verdicts:', verdicts)
if (process.argv.includes('--tree')) {
  for (const [k, n] of tree) if (k.split(' > ').length <= 3) console.log(`${'  '.repeat(k.split(' > ').length - 1)}${k.split(' > ').at(-1)}  (${n})`)
}
if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const x of [...new Set(failures)].slice(0, 40)) console.error(' -', x)
  process.exit(1)
}
console.log('all paths OK')
