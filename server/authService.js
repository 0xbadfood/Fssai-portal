import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { ensureSchema, pool } from './db.js'
import { sendMail } from './mailer.js'

const scryptAsync = promisify(scrypt)
const N = 32768, R = 8, P = 1
const SESSION_DAYS = 7
export const COOKIE = 'fssai_session'

const httpError = (status, message) => Object.assign(new Error(message), { status })
const sha256 = (s) => createHash('sha256').update(s).digest('hex')
const derive = (password, salt, n, r, p) => scryptAsync(password, salt, 64, { N: n, r, p, maxmem: 128 * n * r * 2 })

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$')
}

async function verifyPassword(password, stored) {
  const [, n, r, p, salt, hash] = stored.split('$')
  const expected = Buffer.from(hash, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p)
  return timingSafeEqual(actual, expected)
}

let dummyHash
const publicUser = (u) => ({ name: u.name, email: u.email, phone: u.phone, businessName: u.business_name })

// Failed-login throttle: 5 failures per 15 min per (ip, email).
const attempts = new Map()
const WINDOW_MS = 15 * 60 * 1000
function throttle(key) {
  const now = Date.now()
  const recent = (attempts.get(key) || []).filter((t) => now - t < WINDOW_MS)
  attempts.set(key, recent)
  if (recent.length >= 5) throw httpError(429, 'Too many failed attempts. Try again in 15 minutes.')
}
const recordFailure = (key) => attempts.set(key, [...(attempts.get(key) || []), Date.now()])

async function createSession(userId, userAgent) {
  const token = randomBytes(32).toString('base64url')
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, now() + make_interval(days => $3), $4)",
    [sha256(token), userId, SESSION_DAYS, String(userAgent || '').slice(0, 300)],
  )
  return { token, maxAge: SESSION_DAYS * 86400 }
}

function checkNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters.')
  if (password.length > 128) throw httpError(400, 'Password is too long.')
}

function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
    throw httpError(400, 'Enter a valid email address.')
  }
  return email.trim().toLowerCase()
}

export async function signup({ businessName, name, email, phone, password }, { userAgent }) {
  await ensureSchema()
  const clean = (v, label, max = 150) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw httpError(400, `${label} is required.`)
    return v.trim()
  }
  const biz = clean(businessName, 'Business name')
  const nm = clean(name, 'Your name')
  const ph = clean(phone, 'Phone number', 20)
  if (!/^[0-9+()\-\s]{7,20}$/.test(ph)) throw httpError(400, 'Enter a valid phone number.')
  const mail = validateEmail(email)
  checkNewPassword(password)

  const hash = await hashPassword(password)
  let user
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, name, business_name, phone) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [mail, hash, nm, biz, ph],
    )
    user = rows[0]
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'An account with this email already exists. Try signing in.')
    throw e
  }
  return { user: publicUser(user), session: await createSession(user.id, userAgent) }
}

export async function login({ email, password }, { ip, userAgent }) {
  await ensureSchema()
  const mail = validateEmail(email)
  if (typeof password !== 'string' || !password || password.length > 128) throw httpError(400, 'Enter your password.')
  const key = `${ip}|${mail}`
  throttle(key)

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [mail])
  const user = rows[0]
  // Always run one hash verification so timing doesn't reveal whether the email exists.
  dummyHash ??= await hashPassword('dummy-password')
  const ok = await verifyPassword(password, user ? user.password_hash : dummyHash)
  if (!user || !ok) {
    recordFailure(key)
    throw httpError(401, 'Incorrect email or password.')
  }
  attempts.delete(key)
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id])
  return { user: publicUser(user), session: await createSession(user.id, userAgent) }
}

export async function userFromToken(token) {
  if (!token) return null
  await ensureSchema()
  const { rows } = await pool.query(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
    [sha256(token)],
  )
  return rows[0] ? { id: rows[0].id, ...publicUser(rows[0]) } : null
}

export async function logout(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
}

// ---------- Password reset ----------

const RESET_MINUTES = 30
const resetRequests = new Map() // ip / email -> recent request times
function limitResets(key, max) {
  const now = Date.now()
  const recent = (resetRequests.get(key) || []).filter((t) => now - t < 60 * 60 * 1000)
  if (recent.length >= max) throw httpError(429, 'Too many reset requests. Try again in an hour.')
  resetRequests.set(key, [...recent, now])
}

/** Always answers the same way, so it doesn't reveal which emails have accounts. */
export async function requestPasswordReset({ email }, { ip, origin }) {
  await ensureSchema()
  const mail = validateEmail(email)
  limitResets(`ip|${ip}`, 10)
  limitResets(`email|${mail}`, 3)
  const { rows } = await pool.query('SELECT id, name FROM users WHERE email = $1', [mail])
  if (!rows[0]) return
  const token = randomBytes(32).toString('base64url')
  // One live link at a time: requesting a new one cancels older ones.
  await pool.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [rows[0].id])
  await pool.query(
    'INSERT INTO password_resets (token_hash, user_id, expires_at, ip) VALUES ($1, $2, now() + make_interval(mins => $3), $4)',
    [sha256(token), rows[0].id, RESET_MINUTES, String(ip || '').slice(0, 60)],
  )
  const link = `${origin}/reset-password#token=${token}`
  await sendMail({
    to: mail,
    subject: 'Reset your FSSAI Online password',
    text: `Hi ${rows[0].name},\n\nUse this link to choose a new password. It works once and expires in ${RESET_MINUTES} minutes:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.\n`,
  })
}

/** Sets the new password, signs out every existing session, and signs this browser in. */
export async function resetPassword({ token, password }, { userAgent }) {
  await ensureSchema()
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) throw httpError(400, 'This reset link is not valid. Ask for a new one.')
  checkNewPassword(password)
  const hash = await hashPassword(password)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id',
      [sha256(token)],
    )
    if (!rows[0]) throw httpError(400, 'This reset link has expired or was already used. Ask for a new one.')
    const userId = rows[0].user_id
    const { rows: users } = await client.query('UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING *', [userId, hash])
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId])
    await client.query('COMMIT')
    for (const k of [...attempts.keys()]) if (k.endsWith(`|${users[0].email}`)) attempts.delete(k)
    return { user: publicUser(users[0]), session: await createSession(userId, userAgent) }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}
