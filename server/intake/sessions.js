// The landing-page chat before sign-up. The conversation lives here (intake_sessions), keyed by a random token the
// browser keeps; the first application after sign-up claims it, so nothing is asked twice.
// Typed answers use records and CLM only (allowModel: false), so this public endpoint cannot run the model.
import { randomBytes } from 'node:crypto'
import { ensureSchema, pool } from '../db.js'
import { GRAPH_VERSION, cleanFacts, intakeView } from './index.js'
import { applyAnswer, openClarify, publicTranscript, undoFacts } from './answer.js'
import { logEvent } from './events.js'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const ACKS = { activity: 'Got it 👍', place: 'Nice, noted.', vending: 'Okay, thanks.', trade: 'Got it.', locations: 'Noted.', turnover: 'Perfect, thanks.', online: 'Great.' }
const MAX_LINES = 60

const view = (row) => {
  const facts = cleanFacts(row.facts)
  return { session: row.id, transcript: publicTranscript(row.transcript), clarify: openClarify(facts, row.transcript), ...intakeView(facts) }
}

async function load(id) {
  await ensureSchema()
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) throw httpError(404, 'Session not found')
  const { rows } = await pool.query('SELECT * FROM intake_sessions WHERE id = $1 AND claimed_by IS NULL', [id])
  // A session from an older graph version cannot be resumed; the chat starts again.
  if (!rows[0] || rows[0].graph_version !== GRAPH_VERSION) throw httpError(404, 'Session not found')
  return rows[0]
}

async function save(id, facts, transcript) {
  const { rows } = await pool.query('UPDATE intake_sessions SET facts = $2, transcript = $3, updated_at = now() WHERE id = $1 RETURNING *', [
    id, JSON.stringify(facts), JSON.stringify(transcript.slice(-MAX_LINES)),
  ])
  return rows[0]
}

export async function startSession({ ip }) {
  await ensureSchema()
  const id = randomBytes(16).toString('hex')
  const { rows } = await pool.query('INSERT INTO intake_sessions (id, graph_version, ip) VALUES ($1, $2, $3) RETURNING *', [id, GRAPH_VERSION, ip || null])
  return view(rows[0])
}

export async function resumeSession(id) {
  return view(await load(id))
}

export async function answerSession(id, answer) {
  const row = await load(id)
  const { facts, entry } = await applyAnswer(cleanFacts(row.facts), answer, { allowModel: false, ref: { sessionId: id }, ack: (qid) => ACKS[qid] || null })
  return view(await save(id, facts, [...row.transcript, entry]))
}

export async function undoSession(id) {
  const row = await load(id)
  return view(await save(id, undoFacts(row.transcript), row.transcript.slice(0, -1)))
}

export async function restartSession(id) {
  await load(id)
  return view(await save(id, {}, []))
}

/** "Is this right?" on the result card. */
export async function rateSession(id, { rating, note }) {
  const row = await load(id)
  logEvent({ kind: 'rating', sessionId: id, detail: { rating: String(rating || '').slice(0, 20), note: String(note || '').slice(0, 500), result: intakeView(cleanFacts(row.facts)).result?.licenceId ?? null } })
  return { ok: true }
}

/** Hand an unclaimed session to a new application: -> { facts, transcript } or null. */
export async function claimSession(id, userId) {
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) return null
  await ensureSchema()
  const { rows } = await pool.query(
    `UPDATE intake_sessions SET claimed_by = $2, claimed_at = now()
       WHERE id = $1 AND claimed_by IS NULL AND graph_version = $3 AND updated_at > now() - interval '7 days' RETURNING facts, transcript`,
    [id, userId, GRAPH_VERSION],
  )
  return rows[0] ? { facts: cleanFacts(rows[0].facts), transcript: rows[0].transcript } : null
}
