// Operations console: the queue of paid applications (cases) and who works each one.
// Only ops team members and the admin get here (requireOps); every change is written to case_events.
import { ensureSchema, pool } from './db.js'
import { documentsByUser } from './documentsService.js'
import { cleanFacts } from './intake/index.js'
import { planFor } from './intake/plan.js'

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
