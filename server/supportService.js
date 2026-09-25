import { ensureSchema, pool } from './db.js'
import { CONTACT_VIA, SUPPORT_TOPICS } from '../src/lib/supportTopics.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const toRequest = (r) => ({ id: r.id, topic: r.topic, message: r.message, contactVia: r.contact_via, status: r.status, createdAt: r.created_at })

export async function listSupportRequests(userId) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM support_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId])
  return rows.map(toRequest)
}

export async function createSupportRequest(userId, { topic, message, contactVia }) {
  await ensureSchema()
  if (!SUPPORT_TOPICS.some((t) => t.id === topic)) throw httpError(400, 'Pick a topic.')
  const text = typeof message === 'string' ? message.trim() : ''
  if (text.length < 5) throw httpError(400, 'Tell us a little about what you need.')
  const via = CONTACT_VIA.some((c) => c.id === contactVia) ? contactVia : 'call'
  const { rows: open } = await pool.query("SELECT count(*)::int AS n FROM support_requests WHERE user_id = $1 AND status = 'open'", [userId])
  if (open[0].n >= 10) throw httpError(429, 'You already have several open requests. Our team will get back to you on those first.')
  const { rows } = await pool.query(
    'INSERT INTO support_requests (user_id, topic, message, contact_via) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, topic, text.slice(0, 2000), via],
  )
  return toRequest(rows[0])
}
