// Operations console: the queue of paid applications (cases) and who works each one.
// Only ops team members and the admin get here (requireOps); every change is written to case_events.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ensureSchema, pool, repoRoot } from './db.js'
import { documentsByUser, readDocumentFile, uploadDocument } from './documentsService.js'
import { cleanFacts, intakeView } from './intake/index.js'
import { FIELDS, planFor } from './intake/plan.js'
import { crossCheck } from './opsCheck.js'

const DOC_TYPES = JSON.parse(readFileSync(path.join(repoRoot, 'config/document-types.json'), 'utf8')).types

const httpError = (status, message) => Object.assign(new Error(message), { status })

// The customer's "What happens next" timeline follows these stages.
export const STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'in_review', label: 'In review' },
  { id: 'needs_customer', label: 'Needs customer' },
  { id: 'ready_to_file', label: 'Ready to file' },
  { id: 'session_scheduled', label: 'Session scheduled' },
  { id: 'filed', label: 'Filed (ARN)' },
  { id: 'with_fssai', label: 'With FSSAI' },
  { id: 'granted', label: 'Granted' },
  { id: 'rejected', label: 'Rejected' },
]

export const isOps = (user) => !!user && (user.role === 'ops' || user.role === 'admin')
export function requireOps(user) {
  if (!isOps(user)) throw httpError(403, 'Operations team only.')
}

/** Append to a case's log. actorId null = the system or the customer. */
export function logCaseEvent(client, caseId, actorId, kind, detail = null) {
  return client.query('INSERT INTO case_events (case_id, actor_id, kind, detail) VALUES ($1, $2, $3, $4)', [caseId, actorId, kind, detail && JSON.stringify(detail)])
}

/** A paid application becomes a case (called inside the payment transaction). */
export async function openCase(client, applicationId, userId, detail) {
  const { rows } = await client.query('INSERT INTO cases (application_id, user_id) VALUES ($1, $2) ON CONFLICT (application_id) DO NOTHING RETURNING id', [applicationId, userId])
  if (rows[0]) await logCaseEvent(client, rows[0].id, null, 'opened', detail)
}

export async function listMembers() {
  await ensureSchema()
  const { rows } = await pool.query("SELECT id, name, email, role FROM users WHERE role IN ('ops', 'admin') AND active ORDER BY name")
  return rows
}

/** Flags that need an ops eye, most urgent first. */
function flagsFor(plan, docs, row) {
  const flags = []
  if (row.rated_wrong) flags.push('rated_wrong')
  if (plan.result?.handover?.length) flags.push('expert')
  if (plan.missingDocs.length) flags.push('docs_missing')
  if (plan.docs.some((d) => docs[d.id]?.status === 'review')) flags.push('doc_review')
  if (Object.values(docs).some((d) => d.pdfEncrypted)) flags.push('pdf_locked')
  if (plan.result?.provisional) flags.push('provisional')
  if (row.pay_mode === 'test') flags.push('test_payment')
  return flags
}

/** The queue: every case with what the table shows. Filtering happens in the browser (the list is small). */
export async function listCases(user) {
  requireOps(user)
  await ensureSchema()
  const { rows } = await pool.query(
    `SELECT c.*, a.info, a.facts, a.id AS app_id, u.name, u.business_name, u.phone, u.email, asg.name AS assignee_name,
            (SELECT p.mode FROM payments p WHERE p.application_id = a.id AND p.status = 'paid' LIMIT 1) AS pay_mode,
            (SELECT max(e.at) FROM case_events e WHERE e.case_id = c.id) AS last_event_at,
            EXISTS (SELECT 1 FROM intake_events ie WHERE ie.application_id = a.id AND ie.kind = 'rating' AND ie.detail->>'rating' = 'wrong') AS rated_wrong
       FROM cases c JOIN applications a ON a.id = c.application_id JOIN users u ON u.id = c.user_id
       LEFT JOIN users asg ON asg.id = c.assignee_id
      ORDER BY c.opened_at DESC`,
  )
  const docsByUser = await documentsByUser([...new Set(rows.map((r) => r.user_id))])
  const cases = rows.map((r) => {
    const docs = docsByUser[r.user_id] || {}
    const plan = planFor(cleanFacts(r.facts), r.info, docs, {})
    const required = plan.docs.filter((d) => !d.optional)
    return {
      id: r.id,
      ref: r.app_id.slice(0, 8).toUpperCase(),
      status: r.status,
      business: r.info?.legal_name || r.business_name,
      owner: r.info?.applicant_name || r.name,
      phone: r.info?.mobile || r.phone,
      email: r.email,
      licence: plan.result?.licence || null,
      fee: plan.result?.fee ?? null,
      states: cleanFacts(r.facts).states || [],
      docs: { done: required.length - plan.missingDocs.length, required: required.length },
      flags: flagsFor(plan, docs, r),
      assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null,
      arn: r.arn,
      openedAt: r.opened_at,
      lastEventAt: r.last_event_at,
    }
  })
  return { cases, statuses: STATUSES, members: await listMembers(), me: { id: user.id, name: user.name, role: user.role } }
}

async function loadCase(client, id) {
  if (!/^[0-9a-f-]{36}$/.test(String(id))) throw httpError(404, 'Case not found')
  const { rows } = await client.query('SELECT * FROM cases WHERE id = $1 FOR UPDATE', [id])
  if (!rows[0]) throw httpError(404, 'Case not found')
  return rows[0]
}

async function inTransaction(fn) {
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/** Take a case: it becomes yours; a new case moves to "In review". */
export async function takeCase(user, id) {
  requireOps(user)
  await inTransaction(async (client) => {
    const c = await loadCase(client, id)
    if (c.assignee_id === user.id) return
    await client.query(
      "UPDATE cases SET assignee_id = $2, status = CASE WHEN status = 'new' THEN 'in_review' ELSE status END, updated_at = now() WHERE id = $1",
      [id, user.id],
    )
    await logCaseEvent(client, id, user.id, 'taken', { from: c.assignee_id })
  })
  return listCases(user)
}

/** Hand a case to another active ops member (or the admin), with an optional note. */
export async function transferCase(user, id, { to, note }) {
  requireOps(user)
  await inTransaction(async (client) => {
    const c = await loadCase(client, id)
    const { rows } = await client.query("SELECT id FROM users WHERE id = $1 AND role IN ('ops', 'admin') AND active", [to])
    if (!rows[0]) throw httpError(400, 'Pick someone from the operations team.')
    if (c.assignee_id === to) return
    await client.query('UPDATE cases SET assignee_id = $2, updated_at = now() WHERE id = $1', [id, to])
    await logCaseEvent(client, id, user.id, 'transferred', { from: c.assignee_id, to, note: String(note || '').slice(0, 500) || null })
  })
  return listCases(user)
}

// ---------- The case page ----------

/** Everything the case page shows. Opening it is logged (it shows the customer's documents). */
export async function getCase(user, id, { logView = true } = {}) {
  requireOps(user)
  await ensureSchema()
  if (!/^[0-9a-f-]{36}$/.test(String(id))) throw httpError(404, 'Case not found')
  const { rows } = await pool.query(
    `SELECT c.*, a.info, a.facts, a.transcript, a.status AS app_status, a.id AS app_id,
            u.name, u.email, u.phone, u.business_name, u.created_at AS customer_since, asg.name AS assignee_name
       FROM cases c JOIN applications a ON a.id = c.application_id JOIN users u ON u.id = c.user_id
       LEFT JOIN users asg ON asg.id = c.assignee_id WHERE c.id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) throw httpError(404, 'Case not found')
  if (logView) await logCaseEvent(pool, id, user.id, 'case_viewed')

  const docs = (await documentsByUser([r.user_id]))[r.user_id] || {}
  const facts = cleanFacts(r.facts)
  const plan = planFor(facts, r.info, docs, { name: r.name, businessName: r.business_name, phone: r.phone, email: r.email })
  const view = intakeView(facts)
  const { rows: payments } = await pool.query("SELECT amount_paise, mode, reference, method, created_at FROM payments WHERE application_id = $1 AND status = 'paid'", [r.app_id])
  const { rows: events } = await pool.query(
    'SELECT e.id, e.at, e.kind, e.detail, a.name AS actor FROM case_events e LEFT JOIN users a ON a.id = e.actor_id WHERE e.case_id = $1 ORDER BY e.at DESC, e.id DESC',
    [id],
  )
  // Staff names are looked up here, so customer-facing document records never carry staff ids.
  const { rows: staff } = await pool.query(
    `SELECT d.id, rv.name AS reviewer, up.name AS uploader FROM documents d
       LEFT JOIN users rv ON rv.id = d.ops_reviewed_by LEFT JOIN users up ON up.id = d.uploaded_by
      WHERE d.user_id = $1 AND d.superseded_at IS NULL`,
    [r.user_id],
  )
  const staffOf = Object.fromEntries(staff.map((x) => [x.id, x]))
  const docRow = (typeId, need) => {
    const d = docs[typeId]
    return {
      docTypeId: typeId,
      label: DOC_TYPES[typeId]?.label || typeId,
      why: need?.why || null,
      required: !!need && !need.optional,
      optional: !!need?.optional,
      doc: d ? { ...d, opsReviewedBy: staffOf[d.id]?.reviewer || null, uploadedByName: staffOf[d.id]?.uploader || null } : null,
    }
  }
  const needed = plan.docs.map((d) => docRow(d.id, d))
  const others = Object.keys(docs).filter((t) => !plan.docs.some((d) => d.id === t)).map((t) => docRow(t, null))

  return {
    case: {
      id: r.id, ref: r.app_id.slice(0, 8).toUpperCase(), status: r.status, track: r.track,
      assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null,
      arn: r.arn, licenceNumber: r.licence_number, sessionAt: r.session_at, sessionLink: r.session_link, openedAt: r.opened_at,
    },
    customer: { name: r.name, email: r.email, phone: r.phone, businessName: r.business_name, since: r.customer_since },
    payment: payments[0] ? { amount: payments[0].amount_paise / 100, mode: payments[0].mode, reference: payments[0].reference, method: payments[0].method, at: payments[0].created_at } : null,
    result: plan.result,
    summary: view.summary,
    typed: (r.transcript || []).filter((t) => t.via === 'text').map((t) => ({ question: t.question, answer: t.answer, layer: t.layer || null, clarify: !!t.clarify })),
    fields: plan.fields,
    info: r.info || {},
    missingFields: plan.missingFields,
    documents: needed,
    otherDocuments: others,
    filingCall: plan.filingCall,
    crossCheck: crossCheck(r.info, docs),
    form: plan.form,
    events: events.map((e) => ({ id: e.id, at: e.at, kind: e.kind, actor: e.actor || null, detail: e.detail })),
    statuses: STATUSES,
    members: await listMembers(),
    me: { id: user.id, name: user.name, role: user.role },
  }
}

/** Run fn(client, case) in a transaction on a locked case. */
function withCase(id, fn) {
  return inTransaction(async (client) => fn(client, await loadCase(client, id)))
}

export async function setStatus(user, id, { status, note }) {
  requireOps(user)
  if (!STATUSES.some((s) => s.id === status)) throw httpError(400, 'Unknown status')
  await withCase(id, async (client, c) => {
    if (c.status === status) return
    await client.query('UPDATE cases SET status = $2, updated_at = now() WHERE id = $1', [id, status])
    await logCaseEvent(client, id, user.id, 'status', { from: c.status, to: status, note: String(note || '').slice(0, 500) || null })
  })
  return getCase(user, id, { logView: false })
}

/** Correct one Form A/B detail; the old value is kept in the log. */
export async function updateDetail(user, id, { field, value }) {
  requireOps(user)
  const fd = FIELDS.find((f) => f.id === field)
  if (!fd) throw httpError(400, 'Unknown field')
  const clean = Array.isArray(value) ? value.map((x) => String(x).slice(0, 80)).slice(0, 30) : typeof value === 'string' ? value.slice(0, 300) : null
  if (clean == null) throw httpError(400, 'Enter a value')
  await withCase(id, async (client, c) => {
    const { rows } = await client.query('SELECT info FROM applications WHERE id = $1 FOR UPDATE', [c.application_id])
    const from = rows[0].info?.[field] ?? null
    if (JSON.stringify(from) === JSON.stringify(clean)) return
    await client.query('UPDATE applications SET info = info || $2::jsonb, updated_at = now() WHERE id = $1', [c.application_id, JSON.stringify({ [field]: clean })])
    await logCaseEvent(client, id, user.id, 'detail_changed', { field, label: fd.label, from, to: clean })
  })
  return getCase(user, id, { logView: false })
}

/** Approve or reject the customer's current document of a type (overrides the AI check). */
export async function reviewDocument(user, id, docId, { decision, note }) {
  requireOps(user)
  if (!['approved', 'rejected'].includes(decision)) throw httpError(400, 'Approve or reject')
  const reason = String(note || '').trim().slice(0, 500)
  if (decision === 'rejected' && !reason) throw httpError(400, 'Say what is wrong, so the customer knows what to fix.')
  await withCase(id, async (client, c) => {
    const { rows } = await client.query(
      `UPDATE documents SET ops_status = $3, ops_note = $4, ops_reviewed_by = $5, ops_reviewed_at = now()
        WHERE id = $1 AND user_id = $2 AND superseded_at IS NULL RETURNING doc_type_id, status`,
      [docId, c.user_id, decision, reason || null, user.id],
    )
    if (!rows[0]) throw httpError(404, 'Document not found (it may have been replaced)')
    await logCaseEvent(client, id, user.id, 'document_reviewed', { docType: rows[0].doc_type_id, decision, note: reason || null, ai: rows[0].status })
  })
  return getCase(user, id, { logView: false })
}

/** Upload a document on the customer's behalf (checked by the AI like any upload; marked as uploaded by ops). */
export async function uploadForCustomer(user, id, body) {
  requireOps(user)
  const { rows } = await pool.query('SELECT user_id FROM cases WHERE id = $1', [id])
  if (!rows[0]) throw httpError(404, 'Case not found')
  if (!DOC_TYPES[body?.docTypeId]) throw httpError(400, 'Unknown document type')
  const doc = await uploadDocument(rows[0].user_id, body, { uploadedBy: user.id })
  await logCaseEvent(pool, id, user.id, 'document_uploaded', { docType: doc.docTypeId, ai: doc.status, fileName: doc.file.name })
  return getCase(user, id, { logView: false })
}

export async function addNote(user, id, { text }) {
  requireOps(user)
  const t = String(text || '').trim().slice(0, 2000)
  if (!t) throw httpError(400, 'Write a note first')
  await withCase(id, (client) => logCaseEvent(client, id, user.id, 'note', { text: t }))
  return getCase(user, id, { logView: false })
}

/** A customer's document file for the case page; every full-file open is logged. */
export async function caseDocumentFile(user, id, docId, { preview }) {
  requireOps(user)
  const { rows } = await pool.query('SELECT user_id FROM cases WHERE id = $1', [id])
  if (!rows[0]) throw httpError(404, 'Case not found')
  const file = await readDocumentFile(rows[0].user_id, docId, { preview })
  if (!preview) await logCaseEvent(pool, id, user.id, 'document_viewed', { document: docId, fileName: file.fileName })
  return file
}
