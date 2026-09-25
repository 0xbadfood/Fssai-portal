import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'
import documentConfig from '../../config/document-types.json'

export const DOC_TYPES = documentConfig.types
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const MAX_PDF_PAGES = 4

/** Documents for the signed-in user (loaded from the server), keyed by docTypeId. */
export function useUserDocuments() {
  const { session } = useAuth()
  const email = session?.email
  const [docs, setDocs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!email) {
      setDocs({})
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/documents', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (!cancelled) setDocs(Object.fromEntries(list.map((d) => [d.docTypeId, d])))
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [email])

  const put = useCallback((record) => setDocs((prev) => ({ ...prev, [record.docTypeId]: record })), [])

  return { docs, loading, put }
}

/** Stored image for a document, fetched with auth headers and exposed as an object URL. */
export function useDocumentImage(doc) {
  const { session } = useAuth()
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!doc?.id) return setUrl(null)
    let cancelled = false
    let objectUrl
    fetch(`/api/documents/${doc.id}/preview`)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) setUrl((objectUrl = URL.createObjectURL(blob)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [doc?.id, session?.email])
  return url
}

function toJpeg(source, width, height, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read this file.'))
    r.readAsDataURL(file)
  })

export class PdfPasswordError extends Error {
  constructor(incorrect) {
    super(incorrect ? 'That password did not work. Please try again.' : 'This PDF is password-protected.')
    this.incorrect = incorrect
  }
}

async function renderPdf(file, password) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  let pdf
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: password || undefined }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') throw new PdfPasswordError(e.code === 2)
    throw new Error('This PDF could not be opened. Try another copy or take a photo instead.')
  }
  const pages = []
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PDF_PAGES); n++) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(3, 1600 / Math.max(base.width, base.height)) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    pages.push(canvas)
  }
  const pageCount = pdf.numPages
  await pdf.destroy()
  return {
    preview: toJpeg(pages[0], pages[0].width, pages[0].height, 640, 0.72),
    pages: pages.map((c) => toJpeg(c, c.width, c.height, 1600, 0.85)),
    original: await readAsDataUrl(file),
    pageCount,
  }
}

/**
 * Photo or PDF -> { preview (snapshot), pages (JPEGs for the vision check), original (PDF to store, if any), pageCount }.
 * PDFs are rendered in the browser (first MAX_PDF_PAGES pages); password-protected ones throw PdfPasswordError.
 */
export async function prepareFile(file, password) {
  const type = file.type || (file.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')
  if (!ACCEPTED_MIME.includes(type)) throw new Error('Please upload a photo (JPG, PNG, WebP) or a PDF of the document.')
  if (type === 'application/pdf') {
    if (file.size > 10 * 1024 * 1024) throw new Error('PDF is larger than 10 MB.')
    return renderPdf(file, password)
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('File is larger than 15 MB.')
  const bitmap = await createImageBitmap(file)
  return {
    preview: toJpeg(bitmap, bitmap.width, bitmap.height, 640, 0.72),
    pages: [toJpeg(bitmap, bitmap.width, bitmap.height, 1600, 0.85)],
    original: null,
    pageCount: 1,
  }
}

export async function uploadDocument({ docTypeId, pages, original, pageCount, fileName, sizeBytes }) {
  const res = await fetch('/api/documents/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ docTypeId, pages, original, pageCount, fileName, sizeBytes }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Verification failed (${res.status})`)
  return data
}

export function isSubmittable(doc) {
  return doc?.status === 'accepted' || doc?.status === 'review'
}
