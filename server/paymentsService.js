// Payment for an application's government fee. Only a test (dummy) checkout exists for now: it records the
// payment and submits the application, but no money moves. Amounts are always computed here, never taken
// from the browser. A real gateway would replace `charge` and confirm payments via its webhook.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ensureSchema, pool, repoRoot } from './db.js'
import { listDocuments } from './documentsService.js'
import { GOVT_FEE_PER_YEAR, readiness } from '../src/lib/applicationPlan.js'
import { reconcile, sanitizeFacts } from '../src/lib/intakeQuestions.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const METHODS = ['upi', 'card', 'netbanking']
const config = () => JSON.parse(readFileSync(path.join(repoRoot, 'config', 'payment.json'), 'utf8'))

const toPayment = (r) => ({
  id: r.id, applicationId: r.application_id, purpose: r.purpose, items: r.items, amount: r.amount_paise / 100,
  method: r.method, status: r.status, mode: r.mode, reference: r.reference, createdAt: r.created_at,
})

async function loadApp(userId, applicationId, client = pool) {
  if (!/^[0-9a-f-]{36}$/.test(String(applicationId))) throw httpError(404, 'Application not found')
  const { rows } = await client.query('SELECT * FROM applications WHERE id = $1 AND user_id = $2 FOR UPDATE', [applicationId, userId])
  if (!rows[0]) throw httpError(404, 'Application not found')
  return rows[0]
}

function quoteFor(row, docs) {
  const app = { ...row, facts: reconcile(sanitizeFacts(row.facts)) }
  const r = readiness(app, docs)
  if (!r.kind) throw httpError(400, 'This application has no fee to pay.')
  const items = [{ label: `Government fee: ${r.e.licence} (1 year)`, amount: GOVT_FEE_PER_YEAR[r.e.licence] }]
  const service = Number(config().serviceFeeRupees) || 0
  if (service > 0) items.push({ label: 'FSSAI Online service fee', amount: service })
  return { r, items, total: items.reduce((s, i) => s + i.amount, 0), mode: config().mode }
}

const byType = async (userId) => Object.fromEntries((await listDocuments(userId)).map((d) => [d.docTypeId, d]))

export async function listPayments(userId) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId])
  return rows.map(toPayment)
}

/** What the user's current application costs, and whether it can be paid now. */
export async function currentQuote(userId) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId])
  if (!rows[0]) return null
  const { rows: paid } = await pool.query("SELECT * FROM payments WHERE application_id = $1 AND status = 'paid'", [rows[0].id])
  try {
    const q = quoteFor(rows[0], await byType(userId))
    return { applicationId: rows[0].id, licence: q.r.e.licence, form: q.r.kind, items: q.items, total: q.total, mode: q.mode, payable: q.r.ready && !paid[0], paid: paid[0] ? toPayment(paid[0]) : null }
  } catch {
    return null
  }
}

/** Test checkout: `outcome` 'fail' simulates a declined payment. On success the application is submitted. */
export async function payApplication(userId, { applicationId, method, outcome }) {
  await ensureSchema()
  if (!METHODS.includes(method)) throw httpError(400, 'Choose a payment method.')
  if (config().mode !== 'test') throw httpError(503, 'Online payment is not available yet.')
  const docs = await byType(userId)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const row = await loadApp(userId, applicationId, client)
    const { rows: done } = await client.query("SELECT * FROM payments WHERE application_id = $1 AND status = 'paid'", [row.id])
    if (done[0]) {
      await client.query('COMMIT')
      return { payment: toPayment(done[0]), alreadyPaid: true }
    }
    const q = quoteFor(row, docs)
    if (!q.r.ready) throw httpError(400, 'Finish your application before paying.')
    const status = outcome === 'fail' ? 'failed' : 'paid'
    const reference = `TEST-${randomBytes(5).toString('hex').toUpperCase()}`
    const { rows } = await client.query(
      'INSERT INTO payments (user_id, application_id, items, amount_paise, method, status, mode, reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [userId, row.id, JSON.stringify(q.items), q.total * 100, method, status, q.mode, reference],
    )
    if (status === 'paid') {
      await client.query("UPDATE applications SET status = 'ready', step = 'ready', ready_at = now(), updated_at = now() WHERE id = $1", [row.id])
    }
    await client.query('COMMIT')
    return { payment: toPayment(rows[0]) }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
