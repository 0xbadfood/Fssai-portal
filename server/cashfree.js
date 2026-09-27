// Cashfree Payment Gateway: the API client and webhook check. Keys come from the environment, never from a file
// in the repo: CASHFREE_APP_ID and CASHFREE_SECRET_KEY (deploy: /etc/myfoodlicense/portal.env, read by systemd).
//
// PAYMENT_MODE picks the checkout (default: config/payment.json `mode`):
//   test     the built-in simulator; no gateway, no money
//   sandbox  Cashfree's sandbox (test cards and UPI; no money)
//   live     Cashfree production
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './db.js'

const API_VERSION = '2025-01-01'
const BASE = { sandbox: 'https://sandbox.cashfree.com/pg', live: 'https://api.cashfree.com/pg' }
const MODES = ['test', 'sandbox', 'live']

const httpError = (status, message) => Object.assign(new Error(message), { status })

export function paymentMode() {
  const mode = process.env.PAYMENT_MODE || JSON.parse(readFileSync(path.join(repoRoot, 'config', 'payment.json'), 'utf8')).mode
  if (!MODES.includes(mode)) throw httpError(503, 'Online payment is not configured.')
  return mode
}

const keys = () => ({
  appId: process.env.CASHFREE_APP_ID || process.env.CAHFREE_APP_ID, // the deploy profile spells it CAHFREE
  secret: process.env.CASHFREE_SECRET_KEY,
})

/** The gateway is in use (sandbox or live) and has its keys. */
export function gatewayMode() {
  const mode = paymentMode()
  if (mode === 'test') return null
  const { appId, secret } = keys()
  if (!appId || !secret) throw httpError(503, 'Online payment is not available right now.')
  return mode
}

async function call(method, route, body, { idempotencyKey } = {}) {
  const mode = gatewayMode()
  if (!mode) throw new Error('Cashfree is not in use in test mode')
  const { appId, secret } = keys()
  const res = await fetch(`${BASE[mode]}${route}`, {
    method,
    headers: {
      'x-api-version': API_VERSION,
      'x-client-id': appId,
      'x-client-secret': secret,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Cashfree's message is for us, not the customer (it can name fields); log it and show a plain error.
    console.error(`[cashfree] ${method} ${route} -> ${res.status} ${data.code || ''} ${data.message || ''}`.trim())
    throw httpError(502, 'The payment gateway did not respond as expected. Nothing was charged; try again in a minute.')
  }
  return data
}

/** -> { payment_session_id, order_status, ... } */
export const createOrder = (order) => call('POST', '/orders', order, { idempotencyKey: order.order_id })
/** -> { order_status: ACTIVE | PAID | EXPIRED | TERMINATED | TERMINATION_REQUESTED, order_amount, ... } */
export const getOrder = (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}`)
/** -> [{ cf_payment_id, payment_status: SUCCESS | FAILED | PENDING | USER_DROPPED | ..., payment_amount, payment_group, ... }] */
export const getPayments = (orderId) => call('GET', `/orders/${encodeURIComponent(orderId)}/payments`)

/**
 * A webhook is genuine when x-webhook-signature = base64(HMAC-SHA256(timestamp + raw body, secret key)).
 * The body must be the raw text: parsed and re-serialised JSON can change amounts (170.00 -> 170).
 */
export function verifyWebhook(rawBody, headers) {
  const { secret } = keys()
  const signature = String(headers['x-webhook-signature'] || '')
  const timestamp = String(headers['x-webhook-timestamp'] || '')
  if (!secret || !signature || !timestamp) return false
  const expected = createHmac('sha256', secret).update(timestamp + rawBody).digest()
  const given = Buffer.from(signature, 'base64')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Our payment method names, from Cashfree's payment_group. */
export function methodOf(group) {
  const g = String(group || '')
  if (g === 'upi') return 'upi'
  if (/card/.test(g)) return 'card'
  if (g === 'net_banking') return 'netbanking'
  if (/wallet/.test(g)) return 'wallet'
  if (/pay_later|cardless_emi|emi/.test(g)) return 'paylater'
  return 'other'
}
