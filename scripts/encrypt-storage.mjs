// One-time (and safe to re-run) migration: creates the storage key if missing, then encrypts every stored
// document file that is still plain. Each file is written to a temp file, decrypted back and compared before
// it replaces the original, so an interrupted run never loses a document.
// Run: node scripts/encrypt-storage.mjs
import { readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dbConfig, pool, repoRoot } from '../server/db.js'
import { KEY_FILE, createKeyFile, decrypt, encrypt, isEncrypted } from '../server/storageCrypto.js'

if (createKeyFile()) console.log(`Created storage key at ${KEY_FILE}. Back it up somewhere safe: without it no document can be read.`)
else console.log(`Using storage key at ${KEY_FILE}`)

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (!e.name.endsWith('.tmp')) out.push(p)
  }
  return out
}

const base = path.resolve(repoRoot, dbConfig.storageDir)
const { rows } = await pool.query('SELECT storage_path, preview_path FROM documents')
const known = new Set(rows.flatMap((r) => [r.storage_path, r.preview_path]).filter(Boolean))
let encrypted = 0, already = 0, orphans = 0
for (const abs of await walk(base)) {
  const rel = path.relative(repoRoot, abs).split(path.sep).join('/')
  if (!known.has(rel)) orphans++
  const buf = await readFile(abs)
  if (isEncrypted(buf)) {
    decrypt(buf, rel) // throws if the key or the file is wrong
    already++
    continue
  }
  const tmp = `${abs}.tmp`
  await writeFile(tmp, encrypt(buf, rel), { mode: 0o600 })
  if (!decrypt(await readFile(tmp), rel).equals(buf)) {
    await unlink(tmp)
    throw new Error(`Verification failed for ${rel}; left it unchanged`)
  }
  await rename(tmp, abs)
  encrypted++
}
console.log(`Encrypted ${encrypted} file(s); ${already} already encrypted; ${orphans} not referenced by any document record (encrypted too).`)
await pool.end()
