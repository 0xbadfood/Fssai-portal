// The landing-page chat's server session, carried over to the first application after sign-up.
// Only the session id is kept in the browser; the answers live on the server.
const KEY = 'fssai.intakeSession'

export function saveLandingSession(id) {
  try {
    if (id) localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }))
    else localStorage.removeItem(KEY)
  } catch {}
}

/** The session id from the last 7 days, or null. */
export function landingSession() {
  try {
    const { id, at } = JSON.parse(localStorage.getItem(KEY) || '{}')
    return typeof id === 'string' && Date.now() - at < 7 * 864e5 ? id : null
  } catch {
    return null
  }
}

/** The session id, removed on read so it is handed over once. */
export function takeLandingSession() {
  const id = landingSession()
  saveLandingSession(null)
  return id
}
