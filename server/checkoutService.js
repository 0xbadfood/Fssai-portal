// Checkout through the payment gateway (Cashfree), for an application's fee or an expert-service order.
//
//   start:   we work out the amount (never from the browser), create a gateway order and hand the browser its
//            payment session; the customer pays on the gateway's page and is sent back to /dashboard/payment/return.
//   confirm: the return page and the gateway's signed webhook both ask the gateway's API for the order's state;
//            only a PAID order with a SUCCESS payment of the same amount is recorded. Either may arrive first, or
//            both at once: the gateway row is locked, so the payment is recorded exactly once.
import { randomBytes } from 'node:crypto'
import { ensureSchema, pool } from './db.js'
import * as cashfree from './cashfree.js'
import { applicationCharge, recordApplicationPayment } from './paymentsService.js'
import { orderCharge, recordOrderPayment } from './servicesService.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const EXPIRY_MINUTES = 60

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

const toCheckout = (r, extra = {}) => ({
  id: r.id, status: r.status, amount: r.amount_paise / 100, mode: r.mode,
  for: r.application_id ? { kind: 'application', id: r.application_id } : { kind: 'service', id: r.order_id },
  reference: r.gateway_payment?.cf_payment_id ?? null, ...extra,
})

/**
 * Start paying: { applicationId } or { orderId } -> { checkout, sessionId, mode }. The browser opens the gateway's
 * checkout with sessionId. `origin` is this site's public address (for the return page and the webhook).
 */
export async function startCheckout(userId, { applicationId, orderId }, origin) {
  const mode = cashfree.gatewayMode()
  if (!mode) throw httpError(400, 'Online payment uses the test checkout here.')
  const { rows: users } = await pool.query('SELECT id, name, email, phone FROM users WHERE id = $1', [userId])
  const user = users[0]
  const phone = String(user.phone || '').replace(/\D/g, '').slice(-10)
  if (phone.length !== 10) throw httpError(400, 'Add a 10-digit mobile number to your profile before paying.')

  const { row, charge, reused } = await inTransaction(async (client) => {
    const charge = applicationId ? await applicationCharge(client, userId, applicationId) : await orderCharge(client, userId, orderId)
    const target = applicationId ? ['application_id', charge.row.id] : ['order_id', charge.row.id]
    // Clicking Pay again reuses a recent checkout for the same amount (one gateway order, so one payment).
    const { rows: open } = await client.query(
      `SELECT * FROM gateway_orders WHERE ${target[0]} = $1 AND status = 'created' AND amount_paise = $2 AND mode = $3
         AND session_id IS NOT NULL AND created_at > now() - interval '${EXPIRY_MINUTES - 10} minutes' ORDER BY created_at DESC LIMIT 1`,
      [target[1], charge.totalPaise, mode],
    )
    if (open[0]) return { row: open[0], charge, reused: true }
    const id = `MFL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(6).toString('hex')}`
    const { rows } = await client.query(
      `INSERT INTO gateway_orders (id, user_id, ${target[0]}, items, amount_paise, mode) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, userId, target[1], JSON.stringify(charge.items), charge.totalPaise, mode],
    )
    return { row: rows[0], charge, reused: false }
  })
  if (reused) return { checkout: toCheckout(row), sessionId: row.session_id, mode }

  const created = await cashfree.createOrder({
    order_id: row.id,
    order_amount: row.amount_paise / 100,
    order_currency: 'INR',
    customer_details: { customer_id: user.id, customer_name: user.name.slice(0, 100), customer_email: user.email, customer_phone: phone },
    order_meta: {
      return_url: `${origin}/dashboard/payment/return?order=${row.id}`,
      notify_url: `${origin}/api/payments/cashfree/webhook`,
    },
    order_note: charge.label.length >= 3 ? charge.label : 'MyFoodLicense payment',
    order_expiry_time: new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString(),
  })
  if (!created.payment_session_id) throw httpError(502, 'The payment gateway did not start the payment. Nothing was charged; try again.')
  const { rows } = await pool.query('UPDATE gateway_orders SET session_id = $2, updated_at = now() WHERE id = $1 RETURNING *', [row.id, created.payment_session_id])
  return { checkout: toCheckout(rows[0]), sessionId: created.payment_session_id, mode }
}

/**
 * Where a checkout stands, asking the gateway if it is still open. `userId`: only that customer's checkout
 * (the return page); null for the webhook. -> checkout, with `attempt` ('failed' | 'dropped' | 'pending') while
 * the order is open and the last try did not go through.
 */
export async function syncCheckout(id, userId = null) {
  await ensureSchema()
  if (typeof id !== 'string' || !/^MFL-[\w-]{6,40}$/.test(id)) throw httpError(404, 'Payment not found')
  const { rows } = await pool.query(`SELECT * FROM gateway_orders WHERE id = $1${userId ? ' AND user_id = $2' : ''}`, userId ? [id, userId] : [id])
  const row = rows[0]
  if (!row) throw httpError(404, 'Payment not found')
  if (row.status !== 'created') return toCheckout(row)

  const order = await cashfree.getOrder(id)
  if (order.order_status === 'PAID') {
    const payments = await cashfree.getPayments(id)
    const ok = (Array.isArray(payments) ? payments : []).find((p) => p.payment_status === 'SUCCESS')
    if (ok) return settle(id, ok)
  }
  if (order.order_status === 'EXPIRED' || order.order_status === 'TERMINATED') {
    const { rows: done } = await pool.query("UPDATE gateway_orders SET status = 'expired', updated_at = now() WHERE id = $1 AND status = 'created' RETURNING *", [id])
    return toCheckout(done[0] || row)
  }
  // Still open: say how the last attempt went, so the page can offer another try.
  const payments = await cashfree.getPayments(id).catch(() => [])
  const last = (Array.isArray(payments) ? payments : []).sort((a, b) => String(b.payment_time || '').localeCompare(String(a.payment_time || '')))[0]
  const st = last?.payment_status
  const attempt = !last ? null : ['FAILED', 'CANCELLED', 'VOID'].includes(st) ? 'failed' : ['USER_DROPPED', 'NOT_ATTEMPTED'].includes(st) ? 'dropped' : 'pending'
  return toCheckout(row, { attempt, message: attempt === 'failed' ? String(last.payment_message || '').slice(0, 200) || null : null })
}

/** Record a confirmed payment, once. */
async function settle(id, p) {
  return inTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM gateway_orders WHERE id = $1 FOR UPDATE', [id])
    const g = rows[0]
    if (g.status === 'paid') return toCheckout(g)
    const paidPaise = Math.round(Number(p.payment_amount) * 100)
    const gatewayPayment = {
      cf_payment_id: String(p.cf_payment_id), payment_group: p.payment_group ?? null, bank_reference: p.bank_reference ?? null,
      payment_time: p.payment_time ?? null, payment_amount: p.payment_amount,
    }
    if (paidPaise !== g.amount_paise) {
      // Never expected (the gateway charges the order amount); keep the money visible for staff, fulfil nothing.
      console.error(`[checkout] ${id}: paid ${paidPaise} paise, expected ${g.amount_paise}`)
      const { rows: out } = await client.query(
        "UPDATE gateway_orders SET status = 'paid', gateway_payment = $2, note = 'Amount differs from the order: check and refund', updated_at = now() WHERE id = $1 RETURNING *",
        [id, JSON.stringify(gatewayPayment)],
      )
      return toCheckout(out[0])
    }
    const pay = { items: g.items, totalPaise: g.amount_paise, method: cashfree.methodOf(p.payment_group), status: 'paid', mode: g.mode, reference: gatewayPayment.cf_payment_id }
    let paymentId = null
    let note = null
    if (g.application_id) {
      const { rows: apps } = await client.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [g.application_id])
      const { rows: done } = await client.query("SELECT 1 FROM payments WHERE application_id = $1 AND status = 'paid'", [g.application_id])
      if (!apps[0] || done[0]) {
        // Paid twice (two tabs, two checkouts): the first payment stands; this one must be refunded.
        note = 'Application already paid: refund this payment'
        console.error(`[checkout] ${id}: ${note}`)
      } else {
        paymentId = (await recordApplicationPayment(client, g.user_id, apps[0], pay)).id
      }
    } else {
      const { rows: orders } = await client.query('SELECT * FROM service_orders WHERE id = $1 FOR UPDATE', [g.order_id])
      if (!orders[0]) note = 'Order no longer exists: refund this payment'
      else {
        // A payment that no longer matches what is due is recorded and flagged on the order for staff.
        paymentId = (await recordOrderPayment(client, orders[0], pay)).paymentId
      }
    }
    const { rows: out } = await client.query(
      "UPDATE gateway_orders SET status = 'paid', payment_id = $2, gateway_payment = $3, note = $4, updated_at = now() WHERE id = $1 RETURNING *",
      [id, paymentId, JSON.stringify(gatewayPayment), note],
    )
    return toCheckout(out[0])
  })
}

/** The gateway's webhook: check the signature, then re-check the order with the gateway's API. -> http status */
export async function handleWebhook(rawBody, headers) {
  if (!cashfree.verifyWebhook(rawBody, headers)) return 401
  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return 400
  }
  const id = event?.data?.order?.order_id
  if (typeof id !== 'string' || !id.startsWith('MFL-')) return 200 // not ours (e.g. the dashboard's test event)
  try {
    await syncCheckout(id)
  } catch (e) {
    if (e.status === 404) return 200
    console.error(`[checkout] webhook ${event.type} ${id}: ${e.message}`)
    return 500 // the gateway retries
  }
  return 200
}
