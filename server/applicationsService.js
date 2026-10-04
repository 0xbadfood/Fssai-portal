// Guided applications. The intake runs here on the graph (server/intake); the browser gets the rendered view:
// the current question, summary rows, the result and the plan (details, documents, readiness, form).
import { ensureSchema, pool } from './db.js'
import { documentsFor, documentsForApplications } from './documentsService.js'
import { GRAPH_VERSION, E, cleanFacts, intakeView, isCompatible } from './intake/index.js'
import { applyAnswer, openClarify, publicTranscript, reaskFacts, undoFacts } from './intake/answer.js'
import { DOC_TYPES, FIELDS, SELF_UPLOAD_ONLY, planFor } from './intake/plan.js'
import { claimSession } from './intake/sessions.js'
import { logEvent } from './intake/events.js'

const STEPS = ['photos', 'intake', 'summary', 'details', 'documents', 'forms', 'ready']
const httpError = (status, message) => Object.assign(new Error(message), { status })

/** The application as the browser sees it. */
function toClient(row, docsByType, user) {
  const facts = cleanFacts(row.facts)
  const plan = planFor(facts, row.info, docsByType, user)
  // A new intake question (or a reconciled answer) sends an unfinished application back to the intake.
  const step = row.status !== 'ready' && !['photos', 'intake'].includes(row.step) && E.nextQuestion(facts) ? 'intake' : row.step
  return {
    id: row.id,
    parentId: row.parent_id || null,
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
       step = COALESCE($5, step), status = COALESCE($6, CASE WHEN status = 'pending' THEN 'draft' ELSE status END), ready_at = CASE WHEN $6 = 'ready' THEN now() ELSE ready_at END,
       updated_at = now() WHERE id = $1 RETURNING *`,
    [id, facts && JSON.stringify(facts), info && JSON.stringify(info), transcript && JSON.stringify(transcript.slice(-60)), step ?? null, status ?? null],
  )
  return rows[0]
}

// Opening a pending application (any change to it) makes it a draft: see save().
const respond = async (row, user) => {
  // Applications added for the customer's other premises (see syncAnotherPremises).
  const { rows: kids } = await pool.query('SELECT id, status FROM applications WHERE parent_id = $1 ORDER BY created_at', [row.id])
  return { ...toClient(row, await documentsFor(user.id, row.id), user), anotherPremises: kids }
}
const stepAfterIntake = (facts) => (E.nextQuestion(facts) ? 'intake' : 'summary')
const afterIntake = async (row, user) => {
  await syncAnotherPremises(row)
  return respond(row, user)
}

/** The latest application the customer has opened (a pending one only if there is nothing else). */
export async function currentApplication(user) {
  await ensureSchema()
  const { rows } = await pool.query("SELECT * FROM applications WHERE user_id = $1 ORDER BY (status = 'pending'), created_at DESC LIMIT 1", [user.id])
  return rows[0] ? respond(await upgrade(rows[0]), user) : null
}

export async function getApplication(user, id) {
  return respond(await load(user.id, id), user)
}

const CASE_LABELS = { new: 'Received', in_review: 'In review', needs_customer: 'Needs your input', ready_to_file: 'Ready to file', session_scheduled: 'Filing session booked', filed: 'Filed on FoSCoS', with_fssai: 'With FSSAI', granted: 'Granted', rejected: 'Rejected' }

/** "My applications": one row per application, newest first. */
export async function listApplications(user) {
  await ensureSchema()
  const { rows } = await pool.query(
    `SELECT a.*, c.status AS case_status, c.arn, p.amount_paise AS paid_paise, p.created_at AS paid_at, p.reference AS paid_reference
       FROM applications a LEFT JOIN cases c ON c.application_id = a.id
       LEFT JOIN LATERAL (SELECT * FROM payments p WHERE p.application_id = a.id AND p.status = 'paid' ORDER BY p.created_at LIMIT 1) p ON true
      WHERE a.user_id = $1 ORDER BY a.created_at DESC`,
    [user.id],
  )
  const docs = await documentsForApplications(rows.map((r) => ({ userId: user.id, applicationId: r.id })))
  return rows.map((r) => {
    const facts = cleanFacts(r.facts)
    const plan = planFor(facts, r.info, docs[r.id], user)
    const summary = intakeView(facts).summary || []
    return {
      id: r.id,
      parentId: r.parent_id || null,
      status: r.status,
      step: r.step,
      business: r.info?.legal_name || null,
      entityType: r.info?.entity_type || null,
      applicant: r.info?.applicant_name || null,
      place: summary.find((x) => x.id === 'place')?.value || null,
      fee: plan.result?.fee ?? null,
      premises: { address: r.info?.premises_address || null, city: r.info?.city || null, pincode: r.info?.pincode || null, state: r.info?.state || null },
      licence: plan.result?.licence || null,
      ready: plan.ready,
      // Every premises is paid for on its own (one government fee per application).
      payment: r.paid_paise != null ? { amount: r.paid_paise / 100, at: r.paid_at, reference: r.paid_reference } : null,
      case: r.case_status ? { status: r.case_status, label: CASE_LABELS[r.case_status] || r.case_status, arn: r.arn || null } : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
}

// Business and applicant details carried over to the application for another premises; the premises ones are not.
const SHARED_INFO = ['legal_name', 'entity_type', 'products', 'operating_since', 'applicant_name', 'designation', 'mobile', 'email']

/** The intake answers for the next premises: the same business, at one place (in a state still to be asked if it has several). */
function factsForAnotherPremises(facts) {
  const next = { ...facts, locations: 'one' }
  if (facts.locations === 'multistate') delete next.states
  return cleanFacts(next)
}

function copyOf(from) {
  const facts = factsForAnotherPremises(cleanFacts(from.facts))
  const info = Object.fromEntries(SHARED_INFO.filter((k) => from.info?.[k] != null).map((k) => [k, from.info[k]]))
  return { facts, info }
}

async function insertCopy(from, userId, status) {
  const { facts, info } = copyOf(from)
  const { rows } = await pool.query(
    'INSERT INTO applications (user_id, parent_id, status, step, graph_version, facts, info) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [userId, from.id, status, stepAfterIntake(facts), GRAPH_VERSION, JSON.stringify(facts), JSON.stringify(info)],
  )
  return rows[0]
}

/**
 * "Several places" in the intake: every premises needs its own registration or licence, so once the intake is
 * finished a pending application for the next one is added to My applications (once). Until the customer opens
 * it, it follows this application's answers and business details; answering "just one place" removes it.
 * Only a first application does this; one for another premises doesn't add more.
 */
async function syncAnotherPremises(row) {
  if (row.parent_id || row.status === 'ready') return
  const facts = cleanFacts(row.facts)
  const several = ['many', 'multistate'].includes(facts.locations)
  if (!several) return pool.query("DELETE FROM applications WHERE parent_id = $1 AND status = 'pending'", [row.id])
  if (E.nextQuestion(facts)) return
  const { rows: kids } = await pool.query('SELECT id, status FROM applications WHERE parent_id = $1', [row.id])
  if (!kids.length) return insertCopy(row, row.user_id, 'pending')
  const copy = copyOf(row)
  await pool.query(
    "UPDATE applications SET facts = $2, info = $3, step = $4 WHERE parent_id = $1 AND status = 'pending'",
    [row.id, JSON.stringify(copy.facts), JSON.stringify(copy.info), stepAfterIntake(copy.facts)],
  )
}

/**
 * New application. intakeSession: the landing-page chat's session id; its answers carry over.
 * anotherPremisesOf: an application of this user whose business details (and answers, at one place) carry over.
 */
export async function createApplication(user, { intakeSession, anotherPremisesOf } = {}) {
  await ensureSchema()
  if (anotherPremisesOf) return respond(await insertCopy(await load(user.id, anotherPremisesOf), user.id, 'draft'), user)
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
  return afterIntake(await save(id, { facts, transcript: [...row.transcript, entry], step: stepAfterIntake(facts) }), user)
}

export async function reask(user, id, questionId) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const facts = reaskFacts(cleanFacts(row.facts), questionId)
  return afterIntake(await save(id, { facts, step: stepAfterIntake(facts) }), user)
}

export async function undoLastAnswer(user, id) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  const facts = undoFacts(row.transcript)
  return afterIntake(await save(id, { facts, transcript: row.transcript.slice(0, -1), step: 'intake' }), user)
}

export async function restartIntake(user, id) {
  const row = await load(user.id, id)
  if (row.status === 'ready') throw httpError(409, 'This application is already complete.')
  return afterIntake(await save(id, { facts: {}, transcript: [], step: 'intake' }), user)
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
  if (nextStep === 'ready' && !planFor(effFacts, newInfo, await documentsFor(user.id, id), user).ready) nextStep = undefined
  if (nextStep && !['photos', 'intake'].includes(nextStep) && E.nextQuestion(effFacts)) nextStep = 'intake'
  if (nextStep === 'intake' && !E.nextQuestion(effFacts)) nextStep = 'summary'
  const saved = await save(id, { facts, info: info ? newInfo : undefined, step: nextStep })
  if (info || facts) await syncAnotherPremises(saved)
  return respond(saved, user)
}

export async function markReady(user, id) {
  const row = await load(user.id, id)
  const p = planFor(cleanFacts(row.facts), row.info, await documentsFor(user.id, id), user)
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
