#!/usr/bin/env node
// Operations team accounts (admin only, on the server). There is no sign-up page for ops.
//   node scripts/ops.mjs add --email a@b.in --name "Priya S" [--phone 98…] [--role ops|admin]
//   node scripts/ops.mjs list
//   node scripts/ops.mjs deactivate --email a@b.in      (can't sign in; open sessions end; cases stay assigned)
//   node scripts/ops.mjs activate --email a@b.in
//   node scripts/ops.mjs role --email a@b.in --role admin
//   node scripts/ops.mjs reset-password --email a@b.in  (prints a new password; signs out every session)
// New and reset passwords are generated and printed once; share them privately.
import { randomBytes } from 'node:crypto'
import { ensureSchema, pool } from '../server/db.js'
import { hashPassword } from '../server/authService.js'

const [cmd, ...rest] = process.argv.slice(2)
const opt = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}
const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}
const newPassword = () => randomBytes(12).toString('base64url')
const ROLES = ['ops', 'admin']

async function findOps(email) {
  if (!email) fail('--email is required')
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()])
  if (!rows[0]) fail(`No account for ${email}`)
  if (!ROLES.includes(rows[0].role)) fail(`${email} is a customer account, not an operations account.`)
  return rows[0]
}

async function main() {
  await ensureSchema()
  if (cmd === 'add') {
    const email = opt('email')?.trim().toLowerCase()
    const name = opt('name')?.trim()
    const role = opt('role') || 'ops'
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail('--email is required and must be valid')
    if (!name) fail('--name is required')
    if (!ROLES.includes(role)) fail('--role must be ops or admin')
    const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [email])
    if (rows[0]) fail(`${email} already has an account (${rows[0].role}). Use another email for the operations account.`)
    const password = newPassword()
    await pool.query("INSERT INTO users (email, password_hash, name, business_name, phone, role) VALUES ($1, $2, $3, 'MyFoodLicense operations', $4, $5)", [
      email, await hashPassword(password), name, opt('phone') || '-', role,
    ])
    console.log(`Added ${role} ${name} <${email}>\nPassword (shown once): ${password}\nSign in at /login; they land on /ops.`)
  } else if (cmd === 'list') {
    const { rows } = await pool.query(
      `SELECT u.email, u.name, u.role, u.active, u.last_login_at, count(c.id) AS open_cases FROM users u
         LEFT JOIN cases c ON c.assignee_id = u.id AND c.status NOT IN ('granted', 'rejected')
        WHERE u.role IN ('ops', 'admin') GROUP BY u.id ORDER BY u.role, u.name`,
    )
    console.table(rows.map((r) => ({ email: r.email, name: r.name, role: r.role, active: r.active, open_cases: Number(r.open_cases), last_login: r.last_login_at?.toISOString().slice(0, 16) ?? '-' })))
  } else if (cmd === 'deactivate' || cmd === 'activate') {
    const u = await findOps(opt('email'))
    await pool.query('UPDATE users SET active = $2 WHERE id = $1', [u.id, cmd === 'activate'])
    if (cmd === 'deactivate') {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [u.id])
      const { rows } = await pool.query("SELECT count(*) FROM cases WHERE assignee_id = $1 AND status NOT IN ('granted', 'rejected')", [u.id])
      console.log(`${u.email} deactivated. Open cases still assigned to them: ${rows[0].count} (transfer them from the console).`)
    } else console.log(`${u.email} activated.`)
  } else if (cmd === 'role') {
    const u = await findOps(opt('email'))
    const role = opt('role')
    if (!ROLES.includes(role)) fail('--role must be ops or admin')
    await pool.query('UPDATE users SET role = $2 WHERE id = $1', [u.id, role])
    console.log(`${u.email} is now ${role}.`)
  } else if (cmd === 'reset-password') {
    const u = await findOps(opt('email'))
    const password = newPassword()
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, await hashPassword(password)])
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [u.id])
    console.log(`New password for ${u.email} (shown once): ${password}`)
  } else {
    console.log('usage: node scripts/ops.mjs add|list|deactivate|activate|role|reset-password [--email …] [--name …] [--phone …] [--role ops|admin]')
  }
}

main()
  .catch((e) => fail(e.message))
  .finally(() => pool.end())
