import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { dbConfig, ensureSchema, pool, repoRoot, resolveStoragePath } from './db.js'
import { verifyDocument } from './verifier.js'
import { decrypt, encrypt } from './storageCrypto.js'
import { compareNames } from './compare.js'
import { isDocOk } from './intake/plan.js'

const DOC_TYPES = JSON.parse(readFileSync(path.join(repoRoot, 'config', 'document-types.json'), 'utf8')).types
// Premises documents (rent agreement, layout, NOC, water test) belong to one application; the rest are the person's.
export const PER_PREMISES = new Set(Object.keys(DOC_TYPES).filter((t) => DOC_TYPES[t].perPremises))

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX_PDF_BYTES = 10 * 1024 * 1024
const httpError = (status, message) => Object.assign(new Error(message), { status })

export const toRecord = (r) => ({
  id: r.id,
  userId: r.user_id,
  applicationRef: r.application_ref,
  applicationId: r.application_id || null,
  docTypeId: r.doc_type_id,
  status: r.status,
  file: { name: r.file_name, mime: r.mime, sizeBytes: r.size_bytes, pageCount: r.page_count },
  verification: r.verification,
  pdfEncrypted: !!r.pdf_encrypted,
  opsStatus: r.ops_status || null,
  opsNote: r.ops_note || null,
  opsReviewedAt: r.ops_reviewed_at || null,
  uploadedByOps: !!r.uploaded_by,
  uploadedAt: r.uploaded_at,
})

/** The application a request without one means: the latest the customer has opened (pending ones are waiting). */
export async function currentApplicationId(userId) {
  const { rows } = await pool.query("SELECT id FROM applications WHERE user_id = $1 ORDER BY (status = 'pending'), created_at DESC LIMIT 1", [userId])
  return rows[0]?.id || null
}

/** Current rows -> { applicationId: { docTypeId: record } }: the person's documents plus each application's own. */
function byApplication(rows, appIds) {
  const out = Object.fromEntries(appIds.map((id) => [id, {}]))
  for (const id of appIds) {
    for (const r of rows) {
      if (r.application_id && r.application_id !== id) continue
      const cur = out[id][r.doc_type_id]
      if (!cur || (r.application_id && !cur.applicationId)) out[id][r.doc_type_id] = toRecord(r)
    }
  }
  return out
}

/** The documents an application uses, keyed by type. applicationId null: the person's own documents only. */
export async function documentsFor(userId, applicationId) {
  await ensureSchema()
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE user_id = $1 AND superseded_at IS NULL AND (application_id IS NULL OR application_id = $2) ORDER BY uploaded_at',
    [userId, applicationId],
  )
  return byApplication(rows, [applicationId])[applicationId]
}

/** As a list, for the browser. Without an application id: the current application's (older mobile builds). */
export async function listDocuments(userId, applicationId) {
  const appId = applicationId ? await ownApplication(userId, applicationId) : await currentApplicationId(userId)
  return Object.values(await documentsFor(userId, appId))
}

/** Several applications at once (the ops queue): [{ userId, applicationId }] -> { applicationId: { docTypeId: record } }. */
export async function documentsForApplications(pairs) {
  await ensureSchema()
  const { rows } = await pool.query('SELECT * FROM documents WHERE user_id = ANY($1) AND superseded_at IS NULL ORDER BY uploaded_at', [[...new Set(pairs.map((p) => p.userId))]])
  const out = {}
  for (const { userId, applicationId } of pairs) Object.assign(out, byApplication(rows.filter((r) => r.user_id === userId), [applicationId]))
  return out
}

async function ownApplication(userId, applicationId) {
  if (!/^[0-9a-f-]{36}$/.test(String(applicationId))) throw httpError(404, 'Application not found')
  const { rows } = await pool.query('SELECT id FROM applications WHERE id = $1 AND user_id = $2', [applicationId, userId])
  if (!rows[0]) throw httpError(404, 'Application not found')
  return rows[0].id
}

/** A PDF with an /Encrypt entry needs a password to open (the password itself is never stored). */
export const isEncryptedPdf = (bytes) => bytes.includes('/Encrypt')

const decodeDataUrl = (url) => ({ mime: url.slice(5, url.indexOf(';')), bytes: Buffer.from(url.slice(url.indexOf(',') + 1), 'base64') })

// The ID proof and the address proof must name the same person: an address proof in someone else's name (a
// landlord's, a relative's) is hard to justify at a government office, so it is rejected rather than explained away.
const NAME_PAIR = { identity: 'address', address: 'identity' }

/** Rejects `verification` in place when its holder name differs from the one on the user's other current document. */
async function checkHolderName(userId, docTypeId, verification) {
  const otherType = NAME_PAIR[docTypeId]
  const name = verification.extracted?.holder_name
  if (!otherType || !name || verification.decision === 'rejected') return
  const { rows } = await pool.query('SELECT * FROM documents WHERE user_id = $1 AND doc_type_id = $2 AND superseded_at IS NULL', [userId, otherType])
  const other = rows[0] && toRecord(rows[0])
  const otherName = isDocOk(other) ? other.verification?.extracted?.holder_name : null
  if (compareNames(name, otherName) !== 'mismatch') return
  verification.decision = 'rejected'
  verification.nameMismatch = { holder: name, [otherType]: otherName }
  verification.issues = [
    ...(verification.issues || []),
    docTypeId === 'address'
      ? `This is in the name of ${name}, but your ID proof is in the name of ${otherName}. Upload an address proof in your own name.`
      : `This is in the name of ${name}, but your address proof is in the name of ${otherName}. Upload your own ID, or replace the address proof if that is the wrong one.`,
  ]
}

/** pages: 1-4 page images (JPEG from the browser); original: the uploaded PDF as a data URL, if the user sent a PDF. */
/** uploadedBy: the ops member uploading on the customer's behalf (null when the customer uploads). */
export async function uploadDocument(userId, { docTypeId, applicationId, pages, original, pdfText, fileName, sizeBytes, pageCount: reportedPages }, { uploadedBy = null } = {}) {
  await ensureSchema()
  // A premises document is filed under its application (the given one, else the current one).
  const appId = PER_PREMISES.has(docTypeId) ? (applicationId ? await ownApplication(userId, applicationId) : await currentApplicationId(userId)) : null
  let pdf = null
  if (original != null) {
    if (typeof original !== 'string' || !original.startsWith('data:application/pdf;base64,')) throw httpError(400, 'original must be a PDF')
    pdf = decodeDataUrl(original)
    if (pdf.bytes.length > MAX_PDF_BYTES) throw httpError(413, 'PDF is larger than 10 MB.')
    if (pdf.bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw httpError(400, 'This file is not a valid PDF.')
  }
  // pdfText: the PDF's text layer, extracted in the browser (which has the password for protected PDFs). Not stored.
  const text = pdf != null && typeof pdfText === 'string' ? pdfText.slice(0, 20000) : ''
  const verification = await verifyDocument({ docTypeId, pages, fromPdf: pdf != null, pdfText: text })
  await checkHolderName(userId, docTypeId, verification)
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
    await client.query(
      'UPDATE documents SET superseded_at = now() WHERE user_id = $1 AND doc_type_id = $2 AND application_id IS NOT DISTINCT FROM $3 AND superseded_at IS NULL',
      [userId, docTypeId, appId],
    )
    const { rows } = await client.query(
      `INSERT INTO documents (id, user_id, doc_type_id, status, file_name, mime, size_bytes, storage_path, preview_path, page_count, sha256, model, quality_score, verification, pdf_encrypted, uploaded_by, application_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [id, userId, docTypeId, verification.decision, String(fileName || 'upload').slice(0, 200), stored.mime, Number(sizeBytes) || stored.bytes.length, relPath,
        previewRel, pageCount, createHash('sha256').update(stored.bytes).digest('hex'), verification.model, verification.qualityScore, verification, !!pdf && isEncryptedPdf(pdf.bytes), uploadedBy, appId],
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
