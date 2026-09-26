// The intake on the server. The rules live in the graph (config/intake/graph.v<N>.json) and run in the lab's
// engine (server/intake/engine, copied from ~/fssai-intake-lab). The browser never sees them: it gets the
// current question already rendered, the summary rows and the result, and sends back taps or typed text.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from '../db.js'
import { createEngine, loadGraph } from './engine/index.js'

export const CONFIG = JSON.parse(readFileSync(path.join(repoRoot, 'config/intake/intake.json'), 'utf8'))
export const graph = loadGraph(path.join(repoRoot, 'config/intake', CONFIG.graph))
export const E = createEngine(graph)
export const GRAPH_VERSION = graph.version
/**
 * Versions whose answers are still valid under this graph (same questions, options and facts; e.g. v3 only
 * pages long lists). Their applications and landing sessions carry on; any other version starts the intake again.
 */
export const isCompatible = (version) => version === GRAPH_VERSION || (graph.compatibleWith || []).includes(version)

const TEXT_STEPS = new Set(CONFIG.textSteps)
const PARSED_STEPS = new Set(CONFIG.parsedSteps)

export const questionById = (id) => E.QUESTIONS.find((q) => q.id === id) || null
/** Questions that take typed answers: interpreted ones (records / CLM / model) and ones read by code. */
export const canType = (q) => !!q && (TEXT_STEPS.has(q.id) || PARSED_STEPS.has(q.id))
export const isInterpreted = (q) => !!q && TEXT_STEPS.has(q.id)

/** Facts from the browser, older records or another graph version, coerced to this graph's shape. */
export const cleanFacts = (facts) => E.reconcile(E.sanitizeFacts(facts))

/**
 * The current question as the browser renders it, or null when the intake is finished.
 * suggestState: a state read from the user's documents, preselected on the state question.
 */
export function turnFor(facts, { suggestState = null } = {}) {
  const q = E.nextQuestion(facts)
  if (!q) return null
  const r = E.render(q, facts)
  const turn = { ...r, number: E.summary(facts).length + 1, check: q.id === 'check', typing: canType(q) }
  if (q.kind === 'states') {
    turn.states = {
      all: graph.enums.states,
      popular: graph.enums.popularStates,
      suggested: suggestState && graph.enums.states.includes(suggestState) ? suggestState : null,
    }
  }
  return turn
}

/** Answered questions, each one tappable to change it: { id, title, value }. */
export function summaryFor(facts) {
  return E.summary(facts).map((row) => ({ ...row, title: E.titleFor(questionById(row.id), facts) }))
}

/**
 * The result once every question is answered (null before). Licence and fee come from fixed rules in the graph,
 * never from a model. `provisional` is true while any rule behind it is not yet signed off by the expert.
 */
export function resultFor(facts) {
  if (E.nextQuestion(facts)) return null
  const v = E.verdict(facts)
  return {
    outcome: v.outcome,
    licence: v.licence,
    licenceId: v.licence_id ?? null,
    fee: v.fee ?? null,
    form: E.formKind(v),
    reasons: v.reasons || [],
    guidance: v.guidance || null,
    upsell: v.upsell || null,
    kinds: (v.kobs || []).map((k) => k.label),
    tasks: (v.tasks || []).map(({ id, task, label, licence, fee, text }) => ({ id, task, label, licence: licence ?? null, fee: fee ?? null, text })),
    handover: v.handover || [],
    provisional: !!v.provisional,
    expertOption: !!v.expert_option,
    effectiveDate: v.effectiveDate || null,
    documents: v.documents || [],
  }
}

/** Everything the chat needs to show: question (or null), summary rows and result. */
export function intakeView(facts, opts) {
  return { question: turnFor(facts, opts), summary: summaryFor(facts), result: resultFor(facts), graphVersion: GRAPH_VERSION }
}
