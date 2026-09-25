import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dbConfig, ensureSchema, pool, resolveStoragePath } from './db.js'
import { verifyDocument } from './verifier.js'
import { decrypt, encrypt } from './storageCrypto.js'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX_PDF_BYTES = 10 * 1024 * 1024
const httpError = (status, message) => Object.assign(new Error(message), { status })

const toRecord = (r) => ({
  id: r.id,
  userId: r.user_id,
  applicationRef: r.application_ref,
  docTypeId: r.doc_type_id,
  status: r.status,
  file: { name: r.file_name, mime: r.mime, sizeBytes: r.size_bytes, pageCount: r.page_count },
  verification: r.verification,
  uploadedAt: r.uploaded_at,
})

export async function listDocuments(userId) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM documents WHERE user_id = $1 AND superseded_at IS NULL ORDER BY uploaded_at', [userId])
  return rows.map(toRecord)
}

const decodeDataUrl = (url) => ({ mime: url.slice(5, url.indexOf(';')), bytes: Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') })

/** pages: 1-4 page images (JPEG from the browser); original: the uploaded PDF as a data URL, if the user sent a PDF. */
export async function uploadDocument(userId, { docTypeId, pages, original, fileName, sizeBytes, pageCount: reportedPages }) {
  await ensureSchema()
  let pdf = null
  if (original != null) {
    if (typeof original !== 'string' || !original.startsWith('data:application/pdf;base64,')) throw httpError(400, 'original must be a PDF')
    pdf = decodeDataUrl(original)
    if (pdf.bytes.length > MAX_PDF_BYTES) throw httpError(413, 'PDF is larger than 10 MB.')
    if (pdf.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw httpError(400, 'This file is not a valid PDF.')
  }
  const verification = await verifyDocument({ docTypeId, pages })
  const first = decodeDataUrl(pages[0])
  const stored = pdf || first
  const id = randomUUID()
  const dir = path.posix.join(dbConfig.storageDir, userId)
  const relPath = path.posix.join(dir, `${id}.${EXT[stored.mime]}`)
  const previewRel = pdf ? path.posix.join(dir, `${id}.preview.${EXT[first.mime]}`) : relPath
  const written = [resolveStoragePath(relPath)]
  await mkdir(path.dirname(written[0]), { recursive: true, mode: 0o700 })
  await writeFile(written[0], encrypt(stored.bytes, relPath), { mode: 0o600 })
  if (pdf) {
    written.push(resolveStoragePath(previewRel))
    await writeFile(written[1], encrypt(first.bytes, previewRel), { mode: 0o600 })
  }
  // Display only: the browser reports the PDF's page count (pdfjs); clamp it.
  const pageCount = pdf ? Math.min(Math.max(Number(reportedPages) || pages.length, pages.length), 1000) : 1

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE documents SET superseded_at = now() WHERE user_id = $1 AND doc_type_id = $2 AND superseded_at IS NULL', [userId, docTypeId])
    const { rows } = await client.query(
      `INSERT INTO documents (id, user_id, doc_type_id, status, file_name, mime, size_bytes, storage_path, preview_path, page_count, sha256, model, quality_score, verification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id, userId, docTypeId, verification.decision, String(fileName || 'upload').slice(0, 200), stored.mime, Number(sizeBytes) || stored.bytes.length, relPath,
        previewRel, pageCount, createHash('sha256').update(stored.bytes).digest('hex'), verification.model, verification.qualityScore, verification],
    )
    await client.query('COMMIT')
    return toRecord(rows[0])
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    await Promise.all(written.map((f) => unlink(f).catch(() => {})))
    throw e
  } finally {
    client.release()
  }
}

export async function readDocumentFile(userId, id, { preview = false } = {}) {
  await ensureSchema()
  if (!/^[0-9a-f-]{36}$/.test(id)) throw httpError(404, 'Not found')
  const { rows } = await pool.query('SELECT mime, file_name, storage_path, preview_path FROM documents WHERE id = $1 AND user_id = $2', [id, userId])
  if (!rows.length) throw httpError(404, 'Not found')
  const r = rows[0]
  const rel = preview ? r.preview_path || r.storage_path : r.storage_path
  const mime = preview && r.preview_path && r.preview_path !== r.storage_path ? 'image/jpeg' : r.mime
  return { mime, fileName: r.file_name, data: decrypt(await readFile(resolveStoragePath(rel)), rel) }
}
