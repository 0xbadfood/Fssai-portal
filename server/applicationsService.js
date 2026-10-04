// Guided applications. The intake runs here on the graph (server/intake); the browser gets the rendered view:
// the current question, summary rows, the result and the plan (details, documents, readiness, form).
import { ensureSchema, pool } from './db.js'
import { listDocuments } from './documentsService.js'
import { GRAPH_VERSION, E, cleanFacts, intakeView, isCompatible } from './intake/index.js'
import { applyAnswer, openClarify, publicTranscript, reaskFacts, undoFacts } from './intake/answer.js'
import { DOC_TYPES, FIELDS, SELF_UPLOAD_ONLY, planFor } from './intake/plan.js'
import { claimSession } from './intake/sessions.js'
import { logEvent } from './intake/events.js'

const STEPS = ['photos', 'intake', 'summary', 'details', 'documents', 'forms', 'ready']
const httpError = (status, message) => Object.assign(new Error(message), { status })
const byType = async (userId) => Object.fromEntries((await listDocuments(userId)).map((d) => [d.docTypeId, d]))

/** The application as the browser sees it. */
function toClient(row, docsByType, user) {
  const facts = cleanFacts(row.facts)
  const plan = planFor(facts, row.info, docsByType, user)
  // A new intake question (or a reconciled answer) sends an unfinished application back to the intake.
  const step = row.status !== 'ready' && !['photos', 'intake'].includes(row.step) && E.nextQuestion(facts) ? 'intake' : row.step
  return {
    id: row.id,
    status: row.status,
    step,
    info: row.info,
    transcript: publicTranscript(row.transcript),
    intake: { ...intakeView(facts, { suggestState: plan.readFromDocs.state?.value }), clarify: openClarify(facts, row.transcript) },
    plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readyAt: row.ready_at,
  }
}

async function load(userId, id) {
  await ensureSchema()
  if (!/^[0-9a-f-]{36}$/.test(id)) throw httpError(404, 'Application not found')
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2', [id, userId])
  if (!rows[0]) throw httpError(404, 'Application not found')
  return upgrade(rows[0])
}

/**
 * An unfinished application answered under an incompatible graph version starts its intake again on this one
 * (details and documents stay); one from a compatible version is only re-stamped. A finished one keeps its answers.
 */
async function upgrade(row) {
  if (row.graph_version === GRAPH_VERSION || row.status === 'ready') return row
  if (isCompatible(row.graph_version)) {
    const { rows } = await pool.query('UPDATE applications SET graph_version = $2 WHERE id = $1 RETURNING *', [row.id, GRAPH_VERSION])
    return rows[0]
  }
  const { rows } = await pool.query(
    `UPDATE applications SET facts = '{}', transcript = '[]', graph_version = $2,
       step = CASE WHEN step = 'photos' THEN 'photos' ELSE 'intake' END, updated_at = now() WHERE id = $1 RETURNING *`,
    [row.id, GRAPH_VERSION],
  )
  return rows[0]
}

async function save(id, { facts, info, transcript, step, status }) {
  const { rows } = await pool.query(
    `UPDATE applications SET facts = COALESCE($2, facts), info = COALESCE($3, info), transcript = COALESCE($4, transcript),
       step = COALESCE($5, step), status = COALESCE($6, status), ready_at = CASE WHEN $6 = 'ready' THEN now() ELSE ready_at END,
       updated_at = now() WHERE id = $1 RETURNING *`,
    [id, facts && JSON.stringify(facts), info && JSON.stringify(info), transcript && JSON.stringify(transcript.slice(-60)), step ?? null, status ?? null],
  )
  return rows[0]
}

const respond = async (row, user) => toClient(row, await byType(user.id), user)
const stepAfterIntake = (facts) => (E.nextQuestion(facts) ? 'intake' : 'summary')

export async function currentApplication(user) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id])
  return rows[0] ? respond(await upgrade(rows[0]), user) : null
}

/** New application. intakeSession: the landing-page chat's session id; its answers carry over. */
export async function createApplication(user, { intakeSession } = {}) {
  await ensureSchema()
  const carried = intakeSession ? await claimSession(intakeSession, user.id) : null
  const { rows } = await pool.query(
    "INSERT INTO applications (user_id, step, graph_version, facts, transcript) VALUES ($1, 'photos', $2, $3, $4) RETURNING *",
    [user.id, GRAPH_VERSION, JSON.stringify(carried?.facts || {}), JSON.stringify(carried?.transcript || [])],
  )
  return respond(rows[0], user)
}

export async function answerQuestion(user, id, answer) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const { facts, entry } = await applyAnswer(cleanFacts(row.facts), answer || {}, { allowModel: true, ref: { applicationId: id } })
  return respond(await save(id, { facts, transcript: [...row.transcript, entry], step: stepAfterIntake(facts) }), user)
}

export async function reask(user, id, questionId) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const facts = reaskFacts(cleanFacts(row.facts), questionId)
  return respond(await save(id, { facts, step: stepAfterIntake(facts) }), user)
}

export async function undoLastAnswer(user, id) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const facts = undoFacts(row.transcript)
  return respond(await save(id, { facts, transcript: row.transcript.slice(0, -1), step: 'intake' }), user)
}

export async function restartIntake(user, id) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  return respond(await save(id, { facts: {}, transcript: [], step: 'intake' }), user)
}

const DOC_TYPE_IDS = new Set(Object.keys(DOC_TYPES))

function sanitizeInfo(input) {
  const out = {}
  for (const fd of FIELDS) {
    const v = input?.[fd.id]
    if (typeof v === 'string') out[fd.id] = v.slice(0, 300)
    else if (Array.isArray(v)) out[fd.id] = v.map((x) => String(x).slice(0, 80)).slice(0, 30)
  }
  // Documents the customer will hand to the team instead of uploading (the whole list is sent each time).
  if (Array.isArray(input?.deferred_docs)) out.deferred_docs = [...new Set(input.deferred_docs.filter((t) => DOC_TYPE_IDS.has(t) && !SELF_UPLOAD_ONLY.has(t)))]
  return out
}

export async function updateApplication(user, id, { info, step, optInRegistration }) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const current = cleanFacts(row.facts)
  const facts = typeof optInRegistration === 'boolean' ? cleanFacts({ ...current, opt_in_registration: optInRegistration }) : undefined
  const effFacts = facts || current
  const newInfo = info ? { ...row.info, ...sanitizeInfo(info) } : row.info
  let nextStep = STEPS.includes(step) ? step : undefined
  // The final step is only reachable with everything complete; submitting there still needs the fee paid.
  if (nextStep === 'ready' && !planFor(effFacts, newInfo, await byType(user.id), user).ready) nextStep = undefined
  if (nextStep && !['photos', 'intake'].includes(nextStep) && E.nextQuestion(effFacts)) nextStep = 'intake'
  if (nextStep === 'intake' && !E.nextQuestion(effFacts)) nextStep = 'summary'
  return respond(await save(id, { facts, info: info ? newInfo : undefined, step: nextStep }), user)
}

export async function markReady(user, id) {
  const row = await load(user.id, id)
  const p = planFor(cleanFacts(row.facts), row.info, await byType(user.id), user)
  if (!p.ready) {
    const what = [...p.missingFields, ...p.missingDocs]
    throw httpError(400, `Still missing: ${what.join(', ') || 'intake answers'}`)
  }
  const { rows: paid } = await pool.query("SELECT 1 FROM payments WHERE application_id = $1 AND status = 'paid'", [id])
  if (!paid[0]) throw httpError(402, 'Pay the government fee to submit your application.')
  return respond(await save(id, { step: 'ready', status: 'ready' }), user)
}

/** "Is this right?" on the result card. */
export async function rateResult(user, id, { rating, note }) {
  const row = await load(user.id, id)
  const p = planFor(cleanFacts(row.facts), row.info, {}, user)
  logEvent({ kind: 'rating', applicationId: id, detail: { rating: String(rating || '').slice(0, 20), note: String(note || '').slice(0, 500), result: p.result?.licenceId ?? p.result?.outcome ?? null } })
  return { ok: true }
}
