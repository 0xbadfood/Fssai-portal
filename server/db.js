import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = root
export const dbConfig = JSON.parse(readFileSync(path.join(root, 'config', 'database.json'), 'utf8'))

export const pool = new pg.Pool({
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  max: 5,
})

let ready
export function ensureSchema() {
  ready ??= pool.query(readFileSync(path.join(root, 'server', 'schema.sql'), 'utf8')).catch((e) => {
    ready = undefined
    throw e
  })
  return ready
}

/** Resolve a repo-relative path from the DB/config; refuses anything that escapes the storage dir. */
export function resolveStoragePath(relPath) {
  const base = path.resolve(root, dbConfig.storageDir)
  const abs = path.resolve(root, relPath)
  if (!abs.startsWith(base + path.sep)) throw new Error('Invalid storage path')
  return abs
}
