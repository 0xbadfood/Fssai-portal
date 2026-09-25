// Outgoing email. SMTP settings come from config/mail.json (see config/mail.example.json). Without that file,
// nothing is sent: the message is kept in email_outbox with status 'not_configured' so it can be tested.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { pool, repoRoot } from './db.js'

const CONFIG_FILE = path.join(repoRoot, 'config', 'mail.json')
let transport

function config() {
  if (!existsSync(CONFIG_FILE)) return null
  return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
}

export async function sendMail({ to, subject, text }) {
  const cfg = config()
  if (!cfg) {
    await pool.query("INSERT INTO email_outbox (to_email, subject, body_text, status) VALUES ($1, $2, $3, 'not_configured')", [to, subject, text])
    console.warn(`[mail] not configured (config/mail.json); "${subject}" to ${to} kept in email_outbox`)
    return { sent: false }
  }
  transport ??= nodemailer.createTransport(cfg.smtp)
  try {
    await transport.sendMail({ from: cfg.from, to, subject, text })
    await pool.query("INSERT INTO email_outbox (to_email, subject, status, sent_at) VALUES ($1, $2, 'sent', now())", [to, subject])
    return { sent: true }
  } catch (e) {
    await pool.query("INSERT INTO email_outbox (to_email, subject, status, error) VALUES ($1, $2, 'failed', $3)", [to, subject, String(e.message).slice(0, 500)])
    console.error('[mail] send failed:', e.message)
    return { sent: false }
  }
}
