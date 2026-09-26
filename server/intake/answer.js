// One answer to the current intake question, tapped or typed. Shared by signed-in applications and the
// landing-page chat. The server decides which question is current; an answer to any other question is refused.
import { E, questionById } from './index.js'
import { interpret, redact } from './interpret.js'
import { logEvent } from './events.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })

const CLARIFY_REPLY = "I'm not sure which of these you mean. Could you tap the closest one?"
const STATES_REPLY = { multi: 'Which states? Tap each one, then Continue.', single: 'Which state is it in? Tap it below.' }

/**
 * -> { facts, entry } where entry is the transcript line { questionId, question, via, layer?, answer, reply?,
 * clarify?, before, at }. A typed answer that could not be read leaves the facts unchanged and returns
 * entry.clarify (the best guesses, shown first among the options).
 * ack(questionId): an optional short reply after a tap (the landing chat uses one).
 */
export async function applyAnswer(facts, { questionId, optionIds, states, text }, { allowModel, ref = {}, ack = () => null }) {
  const q = E.nextQuestion(facts)
  if (!q || q.id !== questionId) throw httpError(409, 'That question has changed. Please answer the one on screen.')
  const base = { questionId, question: E.titleFor(q, facts), before: facts, at: new Date().toISOString() }

  if (typeof text === 'string' && text.trim()) {
    const clean = text.trim().slice(0, 1000)
    const r = await interpret(q, facts, clean, { allowModel, ref })
    logEvent({ ...ref, kind: 'typed', step: q.id, text: redact(clean), detail: { layer: r.layer, choice: r.choice || r.states || null, ...(r.detail ? { detail: r.detail } : {}) } })
    if (r.clarify) {
      const reply = q.kind === 'states' ? STATES_REPLY[E.isMulti(q, facts) ? 'multi' : 'single'] : CLARIFY_REPLY
      return { facts, entry: { ...base, via: 'text', layer: r.layer, answer: clean, reply, clarify: r.clarify.guesses } }
    }
    const out = tap(facts, q, r.states ? { states: r.states } : { optionIds: r.choice })
    return { facts: out.facts, entry: { ...base, via: 'text', layer: r.layer, answer: clean, reply: `Got it: ${out.answer}.` } }
  }

  const out = tap(facts, q, { optionIds, states })
  return { facts: out.facts, entry: { ...base, via: 'tap', answer: out.answer, reply: ack(q.id) } }
}

function tap(facts, q, pick) {
  try {
    return E.applyTap(facts, q, pick)
  } catch (e) {
    throw httpError(400, e.message)
  }
}

/** Facts before the last answer (one typed answer can fill several questions, so restore exactly). */
export function undoFacts(transcript) {
  const last = transcript.at(-1)
  if (!last) throw httpError(400, 'Nothing to undo.')
  return E.reconcile(E.sanitizeFacts(last.before || {}))
}

/** Clear one answer so its question is asked again (from the summary). */
export function reaskFacts(facts, questionId) {
  if (!questionById(questionId) || questionId === 'check') throw httpError(400, 'Unknown question')
  return E.reconcile(E.clearQuestion(facts, questionId))
}

/** Transcript lines as the browser shows them (no stored facts). */
export const publicTranscript = (transcript) =>
  transcript.map(({ questionId, via, answer, reply, clarify }) => ({ questionId, via, answer, reply: reply || null, ...(clarify ? { clarify } : {}) }))

/**
 * The open clarification, if the last line asked the user to tap after a typed answer to the current question:
 * { questionId, guesses }. Derived from the transcript so it survives a reload.
 */
export function openClarify(facts, transcript) {
  const last = transcript.at(-1)
  const q = E.nextQuestion(facts)
  return last?.clarify && q?.id === last.questionId ? { questionId: last.questionId, guesses: last.clarify, text: last.answer } : null
}
