// Encryption at rest for stored documents: AES-256-GCM, one random IV per file.
// File layout: "FSV1" | 12-byte IV | 16-byte auth tag | ciphertext. The file's storage path is bound in as
// additional authenticated data, so an encrypted file cannot be swapped with another user's file.
// The key lives in config/secrets/storage.key (or the file named by FSSAI_STORAGE_KEY_FILE), 32 random bytes,
// base64. Losing it makes every stored document unreadable: back it up separately from the storage folder.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { repoRoot } from './db.js'

const MAGIC = Buffer.from('FSV1')
const IV_LEN = 12
const TAG_LEN = 16
export const KEY_FILE = process.env.FSSAI_STORAGE_KEY_FILE || path.join(repoRoot, 'config', 'secrets', 'storage.key')

let key
function loadKey() {
  if (key) return key
  if (!existsSync(KEY_FILE)) throw new Error(`Storage key missing (${KEY_FILE}). Run: node scripts/encrypt-storage.mjs`)
  const k = Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'base64')
  if (k.length !== 32) throw new Error('Storage key must be 32 bytes (base64)')
  key = k
  return key
}

/** Create the key file once. Refuses to overwrite an existing key. */
export function createKeyFile() {
  if (existsSync(KEY_FILE)) return false
  mkdirSync(path.dirname(KEY_FILE), { recursive: true, mode: 0o700 })
  writeFileSync(KEY_FILE, randomBytes(32).toString('base64') + '\n', { mode: 0o600, flag: 'wx' })
  return true
}

export const isEncrypted = (buf) => buf.length >= MAGIC.length + IV_LEN + TAG_LEN && buf.subarray(0, 4).equals(MAGIC)

export function encrypt(plain, relPath) {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv)
  cipher.setAAD(Buffer.from(relPath))
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body])
}

export function decrypt(buf, relPath) {
  if (!isEncrypted(buf)) throw new Error(`Stored file is not encrypted: ${relPath}`)
  const iv = buf.subarray(4, 4 + IV_LEN)
  const tag = buf.subarray(4 + IV_LEN, 4 + IV_LEN + TAG_LEN)
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), iv)
  decipher.setAAD(Buffer.from(relPath))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(buf.subarray(4 + IV_LEN + TAG_LEN)), decipher.final()])
}
