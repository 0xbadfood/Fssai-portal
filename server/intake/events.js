// Intake events for review: the silent reviewer's answers, "Is this right?" ratings, typed answers and errors.
// Logging never breaks the request that triggered it.
import { ensureSchema, pool } from '../db.js'

export function logEvent({ kind, applicationId = null, sessionId = null, step = null, text = null, detail = null }) {
  ensureSchema()
    .then(() =>
      pool.query('INSERT INTO intake_events (kind, application_id, session_id, step, text, detail) VALUES ($1, $2, $3, $4, $5, $6)', [
        kind, applicationId, sessionId, step, text && String(text).slice(0, 500), detail && JSON.stringify(detail),
      ]),
    )
    .catch((e) => console.warn('[intake] event not logged:', e.message))
}
