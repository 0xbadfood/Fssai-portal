// Intake answers tapped in the landing-page chat, carried over to the first application after sign-up.
// Stored per browser only; the server replays them through the normal answer path (so undo still works).
const KEY = 'fssai.landingAnswers'

export function saveLandingAnswers(answers) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ answers, at: Date.now() }))
  } catch {}
}

/** Answers saved in the last 7 days, removed on read so they are used once. */
export function takeLandingAnswers() {
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    const { answers, at } = JSON.parse(raw || '{}')
    return Array.isArray(answers) && Date.now() - at < 7 * 864e5 ? answers : []
  } catch {
    return []
  }
}

export function hasLandingAnswers() {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false
  }
}
