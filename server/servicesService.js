// Expert services: the catalogue (config/services.json), customer orders and their payment, and the expert
// queue. A customer buys a service (or asks for a quote); once paid (or requested) the order appears in the
// expert queue, where only experts can take it. Prices always come from the catalogue on the server.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ensureSchema, pool, repoRoot } from './db.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const METHODS = ['upi', 'card', 'netbanking']
const paymentConfig = () => JSON.parse(readFileSync(path.join(repoRoot, 'config', 'payment.json'), 'utf8'))

// ---------- catalogue ----------

let cached = null
export function catalogue() {
  cached ??= JSON.parse(readFileSync(path.join(repoRoot, 'config', 'services.json'), 'utf8'))
  return cached
}
function findService(id) {
  for (const s of catalogue().sections) {
    const svc = s.services.find((x) => x.id === id)
    if (svc) return { svc, section: s }
  }
  return null
}

/** Public catalogue: everything the pages show (internal notes left out). */
export function publicCatalogue() {
  const { note: _n, expert, ...rest } = catalogue()
  const { confirm: _c, ...profile } = expert
  return { ...rest, expert: profile }
}

const rupees = (paise) => Math.round(paise) / 100
const withGst = (feePaise, label) => {
  const gst = Math.round(feePaise * catalogue().gstRate)
  return { items: [{ label, amount: rupees(feePaise) }, { label: `GST ${Math.round(catalogue().gstRate * 100)}%`, amount: rupees(gst) }], total: feePaise + gst }
}
const perUnit = (price) => price.unit || (price.type === 'monthly' ? 'month' : null)

/** The purchase amount: the catalogue's starting price × quantity, plus GST (the "top-up later" model). */
function purchaseCharge(svc, quantity) {
  const p = svc.price
  const unit = perUnit(p)
  const fee = p.amount * 100 * quantity
  const label = `${svc.name}${unit ? ` (${quantity} × ₹${p.amount.toLocaleString('en-IN')} per ${unit})` : ''}${p.type === 'from' || p.type === 'range' ? ', starting fee' : ''}`
  return withGst(fee, label)
}

// ---------- orders: customer side ----------

const STATUS_LABEL = {
  awaiting_payment: 'Awaiting payment', quote_requested: 'Quote requested', quoted: 'Quote ready to pay', new: 'Paid: waiting for the expert',
  in_progress: 'Expert working on it', awaiting_customer: 'Expert needs something from you', completed: 'Completed', cancelled: 'Cancelled',
}
export const ORDER_STATUSES = Object.entries(STATUS_LABEL).map(([id, label]) => ({ id, label }))

const toOrder = (r) => ({
  id: r.id, ref: r.ref, serviceId: r.service_id, serviceName: r.service_name, sectionId: r.section_id, kind: r.kind,
  quantity: r.quantity, unit: r.unit, brief: r.brief, status: r.status, statusLabel: STATUS_LABEL[r.status],
  due: r.amount_due_paise ? { items: r.due_items, total: rupees(r.amount_due_paise), kind: r.due_kind, note: r.due_note } : null,
  paidAt: r.paid_at, createdAt: r.created_at, updatedAt: r.updated_at,
})

const logEvent = (client, orderId, actorId, kind, detail = null) =>
  client.query('INSERT INTO order_events (order_id, actor_id, kind, detail) VALUES ($1, $2, $3, $4)', [orderId, actorId, kind, detail && JSON.stringify(detail)])

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

/** Buy a service (-> payment page) or ask for a quote (custom-quote services, -> expert queue). */
export async function createOrder(userId, { serviceId, quantity, brief }) {
  const found = findService(String(serviceId || ''))
  if (!found) throw httpError(404, 'That service does not exist.')
  const { svc, section } = found
  const quote = svc.price.type === 'quote'
  const qty = perUnit(svc.price) ? Math.min(50, Math.max(1, Math.floor(Number(quantity) || 1))) : 1
  const text = String(brief || '').trim().slice(0, 2000)
  if (quote && text.length < 10) throw httpError(400, 'Tell the expert briefly what you need, so they can quote.')
  return inTransaction(async (client) => {
    // One unpaid basket per service: buying again updates it rather than piling up unpaid orders.
    if (!quote) {
      const { rows } = await client.query("SELECT id FROM service_orders WHERE user_id = $1 AND service_id = $2 AND status = 'awaiting_payment'", [userId, svc.id])
      if (rows[0]) {
        const charge = purchaseCharge(svc, qty)
        const { rows: upd } = await client.query(
          'UPDATE service_orders SET quantity = $2, brief = $3, amount_due_paise = $4, due_items = $5, updated_at = now() WHERE id = $1 RETURNING *',
          [rows[0].id, qty, text || null, charge.total, JSON.stringify(charge.items)],
        )
        return toOrder(upd[0])
      }
    }
    const ref = `SRV-${randomBytes(3).toString('hex').toUpperCase()}`
    const charge = quote ? null : purchaseCharge(svc, qty)
    const { rows } = await client.query(
      `INSERT INTO service_orders (ref, user_id, service_id, service_name, section_id, kind, quantity, unit, brief, status, amount_due_paise, due_items, due_kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [ref, userId, svc.id, svc.name, section.id, quote ? 'quote' : 'buy', qty, perUnit(svc.price), text || null,
        quote ? 'quote_requested' : 'awaiting_payment', charge?.total ?? null, charge ? JSON.stringify(charge.items) : null, quote ? null : 'purchase'],
    )
    await logEvent(client, rows[0].id, null, quote ? 'quote_requested' : 'created', { quantity: qty })
    return toOrder(rows[0])
  })
}

export async function listMyOrders(userId) {
  await ensureSchema()
  const { rows } = await pool.query(
    "SELECT * FROM service_orders WHERE user_id = $1 AND NOT (status = 'awaiting_payment' AND created_at < now() - interval '30 days') ORDER BY updated_at DESC LIMIT 100",
    [userId],
  )
  return rows.map(toOrder)
}

async function loadMine(client, userId, id, lock = false) {
  if (!/^[0-9a-f-]{36}$/.test(String(id))) throw httpError(404, 'Order not found')
  const { rows } = await client.query(`SELECT * FROM service_orders WHERE id = $1 AND user_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, userId])
  if (!rows[0]) throw httpError(404, 'Order not found')
  return rows[0]
}

export async function getMyOrder(userId, id) {
  await ensureSchema()
  return toOrder(await loadMine(pool, userId, id))
}

/** Test checkout for whatever is due (purchase, quote or top-up). 'fail' simulates a decline. */
export async function payOrder(userId, id, { method, outcome }) {
  if (!METHODS.includes(method)) throw httpError(400, 'Choose a payment method.')
  const mode = paymentConfig().mode
  if (mode !== 'test') throw httpError(503, 'Online payment is not available yet.')
  return inTransaction(async (client) => {
    const o = await loadMine(client, userId, id, true)
    if (!o.amount_due_paise) throw httpError(400, 'Nothing is due on this order.')
    const status = outcome === 'fail' ? 'failed' : 'paid'
    const reference = `TEST-${randomBytes(5).toString('hex').toUpperCase()}`
    const purpose = o.due_kind === 'topup' ? 'service_topup' : 'service'
    const { rows: pay } = await client.query(
      'INSERT INTO payments (user_id, order_id, purpose, items, amount_paise, method, status, mode, reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [userId, o.id, purpose, JSON.stringify(o.due_items), o.amount_due_paise, method, status, mode, reference],
    )
    if (status === 'failed') return { order: toOrder(o), payment: { status, reference } }
    // Paid: the order enters the expert queue (or goes back to the expert who sent the quote / top-up).
    const next = o.status === 'awaiting_payment' || o.status === 'quoted' ? (o.assignee_id ? 'in_progress' : 'new') : o.status
    const { rows } = await client.query(
      `UPDATE service_orders SET status = $2, amount_due_paise = NULL, due_items = NULL, due_kind = NULL, due_note = NULL,
              paid_at = COALESCE(paid_at, now()), updated_at = now() WHERE id = $1 RETURNING *`,
      [o.id, next],
    )
    await logEvent(client, o.id, null, 'paid', { amount: rupees(o.amount_due_paise), kind: o.due_kind, reference, payment: pay[0].id, mode })
    return { order: toOrder(rows[0]), payment: { status, reference } }
  })
}

/** The customer can cancel before paying (or withdraw a quote request). */
export async function cancelMyOrder(userId, id) {
  return inTransaction(async (client) => {
    const o = await loadMine(client, userId, id, true)
    if (!['awaiting_payment', 'quote_requested', 'quoted'].includes(o.status)) throw httpError(400, 'This order is already under way. Ask the expert from the order page.')
    const { rows } = await client.query("UPDATE service_orders SET status = 'cancelled', amount_due_paise = NULL, due_items = NULL, updated_at = now() WHERE id = $1 RETURNING *", [o.id])
    await logEvent(client, o.id, null, 'cancelled_by_customer')
    return toOrder(rows[0])
  })
}

/** The customer answers the expert (when the order is waiting on them); it goes back to the expert. */
export async function replyToOrder(userId, id, { text }) {
  const msg = String(text || '').trim().slice(0, 2000)
  if (!msg) throw httpError(400, 'Write your reply first.')
  return inTransaction(async (client) => {
    const o = await loadMine(client, userId, id, true)
    if (['awaiting_payment', 'cancelled', 'completed'].includes(o.status)) throw httpError(400, 'This order is not open for messages.')
    const next = o.status === 'awaiting_customer' ? 'in_progress' : o.status
    const { rows } = await client.query('UPDATE service_orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [o.id, next])
    await logEvent(client, o.id, null, 'customer_message', { text: msg })
    return toOrder(rows[0])
  })
}

/** Messages the customer can see on their order (expert messages and their own). */
export async function myOrderMessages(userId, id) {
  await ensureSchema()
  await loadMine(pool, userId, id)
  const { rows } = await pool.query(
    "SELECT e.at, e.kind, e.detail, u.name FROM order_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.order_id = $1 AND e.kind IN ('customer_message', 'expert_message', 'charge') ORDER BY e.at",
    [id],
  )
  return rows.map((r) => ({ at: r.at, from: r.kind === 'customer_message' ? 'you' : 'expert', name: r.kind === 'customer_message' ? null : r.name, text: r.detail?.text || r.detail?.note || null, charge: r.kind === 'charge' ? r.detail : null }))
}

// ---------- the expert queue (staff) ----------

export const isStaff = (user) => !!user && ['ops', 'admin', 'expert'].includes(user.role)
const canWork = (user) => user.role === 'expert'
const requireStaff = (user) => { if (!isStaff(user)) throw httpError(403, 'Operations team only.') }

async function experts() {
  const { rows } = await pool.query("SELECT id, name, email FROM users WHERE role = 'expert' AND active ORDER BY name")
  return rows
}

export async function listOrders(user) {
  requireStaff(user)
  await ensureSchema()
  const { rows } = await pool.query(
    `SELECT o.*, u.name AS customer_name, u.business_name, u.email, u.phone, a.name AS assignee_name,
            (SELECT max(e.at) FROM order_events e WHERE e.order_id = o.id AND e.kind = 'customer_message') AS last_customer_msg,
            (SELECT max(e.at) FROM order_events e WHERE e.order_id = o.id AND e.actor_id IS NOT NULL) AS last_staff_at,
            (SELECT p.mode FROM payments p WHERE p.order_id = o.id AND p.status = 'paid' LIMIT 1) AS pay_mode,
            (SELECT COALESCE(sum(p.amount_paise), 0) FROM payments p WHERE p.order_id = o.id AND p.status = 'paid') AS paid_paise
       FROM service_orders o JOIN users u ON u.id = o.user_id LEFT JOIN users a ON a.id = o.assignee_id
      WHERE o.status <> 'awaiting_payment'
      ORDER BY o.updated_at DESC`,
  )
  const orders = rows.map((r) => ({
    ...toOrder(r),
    customer: { name: r.customer_name, business: r.business_name, email: r.email, phone: r.phone },
    assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null,
    paid: rupees(Number(r.paid_paise)),
    flags: [
      ...(r.status === 'quote_requested' ? ['quote_requested'] : []),
      ...(r.last_customer_msg && (!r.last_staff_at || r.last_customer_msg > r.last_staff_at) ? ['customer_replied'] : []),
      ...(r.pay_mode === 'test' ? ['test_payment'] : []),
    ],
  }))
  return { orders, statuses: ORDER_STATUSES, experts: await experts(), me: { id: user.id, name: user.name, role: user.role }, canWork: canWork(user) }
}

async function loadOrder(client, id, lock = false) {
  if (!/^[0-9a-f-]{36}$/.test(String(id))) throw httpError(404, 'Order not found')
  const { rows } = await client.query(`SELECT * FROM service_orders WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
  if (!rows[0] || rows[0].status === 'awaiting_payment') throw httpError(404, 'Order not found')
  return rows[0]
}

export async function getOrder(user, id) {
  requireStaff(user)
  await ensureSchema()
  const o = await loadOrder(pool, id)
  const [{ rows: cust }, { rows: events }, { rows: pays }, { rows: asg }] = await Promise.all([
    pool.query('SELECT name, business_name, email, phone, created_at FROM users WHERE id = $1', [o.user_id]),
    pool.query('SELECT e.at, e.kind, e.detail, u.name FROM order_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.order_id = $1 ORDER BY e.at', [id]),
    pool.query("SELECT amount_paise, status, mode, reference, purpose, created_at, items FROM payments WHERE order_id = $1 ORDER BY created_at", [id]),
    o.assignee_id ? pool.query('SELECT id, name FROM users WHERE id = $1', [o.assignee_id]) : { rows: [] },
  ])
  const found = findService(o.service_id)
  return {
    order: { ...toOrder(o), assignee: asg[0] || null },
    service: found ? { ...found.svc, section: found.section.title, needs: found.section.needs } : null,
    customer: cust[0] && { name: cust[0].name, business: cust[0].business_name, email: cust[0].email, phone: cust[0].phone, since: cust[0].created_at },
    payments: pays.map((p) => ({ amount: rupees(p.amount_paise), status: p.status, mode: p.mode, reference: p.reference, purpose: p.purpose, at: p.created_at, items: p.items })),
    events: events.map((e) => ({ at: e.at, kind: e.kind, who: e.name || null, detail: e.detail })),
    statuses: ORDER_STATUSES,
    experts: await experts(),
    me: { id: user.id, name: user.name, role: user.role },
    canWork: canWork(user) && (!o.assignee_id || o.assignee_id === user.id),
  }
}

/** Experts take orders; nobody else can. */
export async function takeOrder(user, id) {
  if (!canWork(user)) throw httpError(403, 'Only an expert can take expert-service orders.')
  await inTransaction(async (client) => {
    const o = await loadOrder(client, id, true)
    if (o.assignee_id === user.id) return
    await client.query("UPDATE service_orders SET assignee_id = $2, status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END, updated_at = now() WHERE id = $1", [id, user.id])
    await logEvent(client, id, user.id, 'taken', { from: o.assignee_id })
  })
  return getOrder(user, id)
}

/** Hand an order to another expert: by an expert, or assigned by the admin. */
export async function transferOrder(user, id, { to, note }) {
  if (!canWork(user) && user.role !== 'admin') throw httpError(403, 'Only an expert or the admin can assign expert orders.')
  await inTransaction(async (client) => {
    const o = await loadOrder(client, id, true)
    const { rows } = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'expert' AND active", [to])
    if (!rows[0]) throw httpError(400, 'Pick an expert.')
    if (o.assignee_id === to) return
    await client.query("UPDATE service_orders SET assignee_id = $2, status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END, updated_at = now() WHERE id = $1", [id, to])
    await logEvent(client, id, user.id, 'transferred', { from: o.assignee_id, to, note: String(note || '').slice(0, 500) || null })
  })
  return getOrder(user, id)
}

async function asAssignee(user, id, fn) {
  if (!canWork(user)) throw httpError(403, 'Only an expert can work on expert-service orders.')
  await inTransaction(async (client) => {
    const o = await loadOrder(client, id, true)
    if (o.assignee_id !== user.id) throw httpError(403, 'Take this order first.')
    await fn(client, o)
  })
  return getOrder(user, id)
}

const WORK_STATUSES = ['in_progress', 'awaiting_customer', 'completed', 'cancelled']
export function setOrderStatus(user, id, { status, note }) {
  if (!WORK_STATUSES.includes(status)) throw httpError(400, 'Pick a status.')
  return asAssignee(user, id, async (client, o) => {
    await client.query('UPDATE service_orders SET status = $2, updated_at = now() WHERE id = $1', [id, status])
    await logEvent(client, id, user.id, 'status', { from: o.status, to: status, note: String(note || '').slice(0, 500) || null })
  })
}

/** An internal note (staff only), or a message the customer sees on their order. */
export function addOrderNote(user, id, { text, toCustomer }) {
  const msg = String(text || '').trim().slice(0, 2000)
  if (!msg) throw httpError(400, 'Write something first.')
  return asAssignee(user, id, async (client) => {
    await logEvent(client, id, user.id, toCustomer ? 'expert_message' : 'note', { text: msg })
    await client.query('UPDATE service_orders SET updated_at = now() WHERE id = $1', [id])
  })
}

/** A quote (for a quote request) or a top-up (more work than the starting fee covered): fee + GST, due now. */
export function chargeOrder(user, id, { amount, note }) {
  const fee = Math.round(Number(amount) * 100)
  if (!Number.isFinite(fee) || fee < 10000 || fee > 1e9) throw httpError(400, 'Enter the fee in rupees (at least ₹100).')
  return asAssignee(user, id, async (client, o) => {
    if (o.amount_due_paise) throw httpError(400, 'A payment is already waiting for the customer.')
    if (['completed', 'cancelled'].includes(o.status)) throw httpError(400, 'This order is closed.')
    const kind = o.status === 'quote_requested' ? 'quote' : 'topup'
    const charge = withGst(fee, kind === 'quote' ? `${o.service_name}: quoted fee` : `${o.service_name}: additional work`)
    await client.query(
      `UPDATE service_orders SET amount_due_paise = $2, due_items = $3, due_kind = $4, due_note = $5,
              status = CASE WHEN status = 'quote_requested' THEN 'quoted' ELSE status END, updated_at = now() WHERE id = $1`,
      [id, charge.total, JSON.stringify(charge.items), kind, String(note || '').slice(0, 1000) || null],
    )
    await logEvent(client, id, user.id, 'charge', { kind, fee: fee / 100, total: rupees(charge.total), note: String(note || '').slice(0, 1000) || null })
  })
}
