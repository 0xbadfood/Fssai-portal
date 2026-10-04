// Account field rules shared by the sign-up / reset pages and the server (server/authService.js), so both say the same thing.

// ---- Password (moderate): 8+ characters with a letter and a number, not a common password, not your own details.

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

const COMMON_PASSWORDS = new Set(
  `password password1 password12 password123 passw0rd p@ssw0rd p@ssword 12345678 123456789 1234567890 0123456789 87654321
  11111111 00000000 12341234 11223344 qwerty12 qwerty123 qwertyuiop 1q2w3e4r 1q2w3e4r5t zaq12wsx asdf1234 asdfghjkl
  abc12345 abcd1234 abcdefg1 iloveyou iloveyou1 welcome1 welcome123 admin123 administrator letmein1 trustno1 sunshine1
  princess1 football1 cricket123 monkey123 dragon123 master123 test1234 india123 india@123 bharat123 changeme changeme1
  fssai123 fssai@123 food1234 foodlicense myfoodlicense license123 licence123`.split(/\s+/),
)

const tokens = ({ email, name, phone } = {}) =>
  [String(email || '').split('@')[0], ...String(name || '').split(/\s+/), String(phone || '').replace(/\D/g, '').slice(-10)]
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4)

/** The rules as a checklist for live assistance: [{ id, label, ok }]. `who`: { email, name, phone } typed so far. */
export function passwordChecks(password, who) {
  const pw = String(password || '')
  const lower = pw.toLowerCase()
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN} characters`, ok: pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX },
    { id: 'letter', label: 'A letter', ok: /\p{L}/u.test(pw) },
    { id: 'number', label: 'A number', ok: /\d/.test(pw) },
    {
      id: 'guessable',
      label: 'Not a common password or your own name, email or phone',
      ok: !!pw && !COMMON_PASSWORDS.has(lower) && new Set(lower).size >= 4 && !tokens(who).some((t) => lower.includes(t)),
    },
  ]
}

/** First broken rule as a sentence, or null. */
export function passwordProblem(password, who) {
  const pw = String(password || '')
  if (pw.length > PASSWORD_MAX) return 'Password is too long.'
  const failed = passwordChecks(pw, who).find((c) => !c.ok)
  if (!failed) return null
  return {
    length: `Password must be at least ${PASSWORD_MIN} characters.`,
    letter: 'Password must include a letter.',
    number: 'Password must include a number.',
    guessable: 'That password is too easy to guess. Avoid common passwords and your own name, email or phone.',
  }[failed.id]
}

/** 0 = breaks a rule, 1 = okay, 2 = good, 3 = strong (12+ characters, mixed case, a symbol each add a step). */
export function passwordStrength(password, who) {
  const pw = String(password || '')
  if (passwordProblem(pw, who)) return 0
  const extras = [pw.length >= 12, /[a-z]/.test(pw) && /[A-Z]/.test(pw), /[^\p{L}\d]/u.test(pw)].filter(Boolean).length
  return Math.min(3, 1 + extras)
}

// ---- Indian mobile number: 10 digits starting 6–9; +91, 91 or 0 in front, spaces and dashes are allowed.

/** The 10-digit number, or null. */
export function normalizeMobile(input) {
  const raw = String(input || '').trim()
  if (!/^[\d\s+\-()]*$/.test(raw)) return null
  let d = raw.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : null
}

export function mobileProblem(input) {
  const raw = String(input || '').trim()
  if (!raw) return 'Enter your mobile number.'
  if (!/^[\d\s+\-()]*$/.test(raw)) return 'Use digits only for the mobile number.'
  if (normalizeMobile(raw)) return null
  const d = raw.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  if (d.length !== 10) return `A mobile number has 10 digits; this has ${d.length}.`
  return 'Indian mobile numbers start with 6, 7, 8 or 9.'
}

// ---- Email: RFC-shaped address with a real-looking domain; typo hints for common providers.

const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

export function emailProblem(input) {
  const email = String(input || '').trim()
  if (!email) return 'Enter your email address.'
  if (email.length > 254) return 'That email address is too long.'
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1 || email.indexOf('@') !== at) return 'An email address looks like name@example.com.'
  const local = email.slice(0, at)
  const labels = email.slice(at + 1).toLowerCase().split('.')
  if (local.length > 64 || !LOCAL.test(local)) return 'The part before the @ isn’t valid: check for spaces, two dots in a row or unusual symbols.'
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return 'The part after the @ isn’t a valid domain, e.g. gmail.com.'
  if (!/^[a-z]{2,24}$/.test(labels.at(-1))) return 'The domain must end in something like .com or .in.'
  return null
}

// Real domains one or two letters from another one (ymail, live.in) are listed so they aren't "corrected".
const PROVIDERS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'hotmail.com', 'outlook.com', 'outlook.in', 'live.com', 'live.in', 'msn.com', 'icloud.com', 'me.com', 'mail.com', 'aol.com', 'rediffmail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'zohomail.in']

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = cur
    }
  }
  return row[b.length]
}

/** "Did you mean …?" for a likely typo of a common provider (gmial.com, gmail.con, yaho.co.in), else null. */
export function emailSuggestion(input) {
  const email = String(input || '').trim()
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  const domain = email.slice(at + 1).toLowerCase()
  if (!domain || PROVIDERS.includes(domain)) return null
  let best = null
  for (const p of PROVIDERS) {
    const d = distance(domain, p)
    if (d <= 2 && (!best || d < best.d)) best = { p, d }
  }
  return best ? `${email.slice(0, at)}@${best.p}` : null
}
