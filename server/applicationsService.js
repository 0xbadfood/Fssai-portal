import { ensureSchema, pool } from './db.js'
import { listDocuments } from './documentsService.js'
import { QUESTIONS, applyTap, clearQuestion, divergences, mergeInterpretation, nextQuestion, reconcile, sanitizeFacts, titleFor } from '../src/lib/intakeQuestions.js'
import { interpretAnswer } from './intakeInterpreter.js'
import { FIELDS, readiness } from '../src/lib/applicationPlan.js'

const STEPS = ['photos', 'intake', 'summary', 'details', 'documents', 'forms', 'ready']
const httpError = (status, message) => Object.assign(new Error(message), { status })

const toApp = (r) => {
  const facts = currentFacts(r)
  // A new intake question (or a reconciled answer) sends an unfinished application back to the intake.
  const step = r.status !== 'ready' && !['photos', 'intake'].includes(r.step) && nextQuestion(facts) ? 'intake' : r.step
  return { ...rowToApp(r), step, facts }
}

const rowToApp = (r) => ({
  id: r.id,
  status: r.status,
  step: r.step,
  facts: r.facts,
  info: r.info,
  transcript: r.transcript,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  readyAt: r.ready_at,
})

async function load(userId, id) {
  await ensureSchema()
  if (!/^[0-9a-f-]{36}$/.test(id)) throw httpError(404, 'Application not found')
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [id, userId])
  if (!rows[0]) throw httpError(404, 'Application not found')
  return rows[0]
}

async function save(id, { facts, info, transcript, step, status }) {
  const { rows } = await pool.query(
    `UPDATE applications SET facts = COALESCE($2, facts), info = COALESCE($3, info), transcript = COALESCE($4, transcript),
       step = COALESCE($5, step), status = COALESCE($6, status), ready_at = CASE WHEN $6 = 'ready' THEN now() ELSE ready_at END,
       updated_at = now() WHERE id = $1 RETURNING *`,
    [id, facts && JSON.stringify(facts), info && JSON.stringify(info), transcript && JSON.stringify(transcript), step ?? null, status ?? null],
  )
  return toApp(rows[0])
}

// Older records used a different fact shape; sanitize + reconcile brings them up to date on read.
const currentFacts = (r) => reconcile(sanitizeFacts(r.facts))

const stepAfterIntake = (facts) => (nextQuestion(facts) ? 'intake' : 'summary')

export async function currentApplication(userId) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])
  return rows[0] ? toApp(rows[0]) : null
}

/** New application; `answers` are intake answers given on the landing page before sign-up, replayed like normal answers. */
export async function createApplication(userId, { answers } = {}) {
  await ensureSchema()
  const { rows } = await pool.query("INSERT INTO applications (user_id, step) VALUES ($1, 'photos') RETURNING *", [userId])
  const id = rows[0].id
  let replayed = false
  for (const a of (Array.isArray(answers) ? answers : []).slice(0, QUESTIONS.length)) {
    try {
      await answerQuestion(userId, id, a || {})
      replayed = true
    } catch (e) {
      console.warn('[applications] skipped landing answer:', e.message)
    }
  }
  return replayed ? save(id, { step: 'photos' }) : toApp(rows[0])
}

export async function answerQuestion(userId, id, { questionId, optionIds, states, text }) {
  const row = await load(userId, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const question = QUESTIONS.find((q) => q.id === questionId)
  if (!question) throw httpError(400, 'Unknown question')
  const before = currentFacts(row)
  let facts
  let entry

  if (typeof text === 'string' && text.trim()) {
    const clean = text.trim().slice(0, 1000)
    const r = await interpretAnswer(before, question, clean)
    facts = mergeInterpretation(before, question, r, clean)
    const understood = JSON.stringify(facts) !== JSON.stringify({ ...before, description: facts.description })
    // Don't confirm as fact something that disagrees with an earlier answer; the check question comes next.
    const flagged = divergences(facts).some((d) => !divergences(before).some((b) => b.id === d.id))
    entry = {
      questionId, via: 'text', layer: r.layer, answer: clean,
      reply: !understood
        ? "Sorry, I couldn't work that out — could you tap one of the options instead?"
        : flagged ? "Thanks! One thing doesn't quite match what you told me before, so let me check." : r.reply || 'Got it!',
    }
  } else {
    try {
      const r = applyTap(before, question, { optionIds, states })
      facts = r.facts
      entry = { questionId, via: 'tap', answer: r.answer }
    } catch (e) {
      throw httpError(400, e.message)
    }
  }
  const transcript = [...row.transcript, { ...entry, question: titleFor(question, before), before, at: new Date().toISOString() }].slice(-60)
  return save(id, { facts, transcript, step: stepAfterIntake(facts) })
}

export async function reask(userId, id, questionId) {
  const row = await load(userId, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  if (!QUESTIONS.some((q) => q.id === questionId)) throw httpError(400, 'Unknown question')
  const facts = reconcile(clearQuestion(currentFacts(row), questionId))
  return save(id, { facts, step: stepAfterIntake(facts) })
}

export async function undoLastAnswer(userId, id) {
  const row = await load(userId, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const last = row.transcript.at(-1)
  if (!last) throw httpError(400, 'Nothing to undo.')
  // Restore the exact facts from before that answer (one typed answer can fill several questions).
  const facts = reconcile(sanitizeFacts(last.before ?? clearQuestion(row.facts, last.questionId)))
  return save(id, { facts, transcript: row.transcript.slice(0, -1), step: 'intake' })
}

export async function restartIntake(userId, id) {
  const row = await load(userId, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  return save(id, { facts: {}, transcript: [], step: 'intake' })
}

function sanitizeInfo(input) {
  const out = {}
  for (const fd of FIELDS) {
    const v = input?.[fd.id]
    if (typeof v === 'string') out[fd.id] = v.slice(0, 300)
    else if (Array.isArray(v)) out[fd.id] = v.map((x) => String(x).slice(0, 80)).slice(0, 30)
  }
  return out
}

export async function updateApplication(userId, id, { info, step, optInRegistration }) {
  const row = await load(userId, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const facts = typeof optInRegistration === 'boolean' ? { ...currentFacts(row), opt_in_registration: optInRegistration } : undefined
  const effFacts = facts || currentFacts(row)
  let nextStep = STEPS.includes(step) ? step : undefined
  // The final step is only reachable with everything complete; submitting there still needs the fee paid.
  if (nextStep === 'ready') {
    const docs = Object.fromEntries((await listDocuments(userId)).map((d) => [d.docTypeId, d]))
    const newInfo = { ...row.info, ...sanitizeInfo(info || {}) }
    if (!readiness({ ...toApp(row), facts: effFacts, info: newInfo }, docs).ready) nextStep = undefined
  }
  if (nextStep && !['photos', 'intake'].includes(nextStep) && nextQuestion(effFacts)) nextStep = 'intake'
  if (nextStep === 'intake' && !nextQuestion(effFacts)) nextStep = 'summary'
  return save(id, { facts, info: info ? { ...row.info, ...sanitizeInfo(info) } : undefined, step: nextStep })
}

export async function markReady(userId, id) {
  const row = await load(userId, id)
  const docs = Object.fromEntries((await listDocuments(userId)).map((d) => [d.docTypeId, d]))
  const r = readiness(toApp(row), docs)
  if (!r.ready) {
    const what = [...r.missing.map((f) => f.label), ...r.missingDocs.map((d) => d.id)]
    throw httpError(400, `Still missing: ${what.join(', ') || 'intake answers'}`)
  }
  if (r.kind) {
    const { rows: paid } = await pool.query("SELECT 1 FROM payments WHERE application_id = $1 AND status = 'paid'", [id])
    if (!paid[0]) throw httpError(402, 'Pay the government fee to submit your application.')
  }
  return save(id, { step: 'ready', status: 'ready' })
}


