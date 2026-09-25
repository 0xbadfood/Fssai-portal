import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, FileImage, FileText, Loader2, Lock, RefreshCcw, ScanSearch, UploadCloud, XCircle } from 'lucide-react'
import { DOC_TYPES, PdfPasswordError, prepareFile, uploadDocument, useDocumentImage } from '../../lib/documents.js'

const RESULT_STYLE = {
  accepted: { ring: 'border-green-200 bg-green-50/40', badge: 'bg-green-100 text-green-700', label: 'Verified', Icon: CheckCircle2 },
  review: { ring: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-100 text-amber-700', label: 'Accepted - needs officer review', Icon: AlertTriangle },
  rejected: { ring: 'border-red-200 bg-red-50/40', badge: 'bg-red-100 text-red-700', label: 'Not acceptable', Icon: XCircle },
}

export default function DocumentUploadCard({ docTypeId, label, tag, doc, onSave }) {
  const spec = DOC_TYPES[docTypeId]
  const [snap, setSnap] = useState(null) // local preview of the just-uploaded file, until the stored copy loads
  const storedImage = useDocumentImage(doc)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(null) // { preview, step }
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [open, setOpen] = useState(false)
  const [locked, setLocked] = useState(null) // { file, password, incorrect } while asking for a PDF password

  // Cosmetic progress through the questions while the model works
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setBusy((b) => (b ? { ...b, step: Math.min(b.step + 1, spec.questions.length) } : b)), 1400)
    return () => clearInterval(t)
  }, [busy === null, spec.questions.length])

  async function handleFile(file, password) {
    if (!file) return
    setError('')
    let prepared
    try {
      prepared = await prepareFile(file, password)
      setLocked(null)
    } catch (e) {
      if (e instanceof PdfPasswordError) setLocked({ file, password: '', incorrect: e.incorrect })
      else setError(e.message || 'Could not read this file.')
      return
    }
    setBusy({ preview: prepared.preview, step: 0 })
    try {
      const record = await uploadDocument({
        docTypeId,
        pages: prepared.pages,
        original: prepared.original,
        pageCount: prepared.pageCount,
        fileName: file.name,
        sizeBytes: file.size,
      })
      setSnap({ id: record.id, url: prepared.preview })
      onSave(record)
    } catch (e) {
      setError(`${e.message}. Your document was not lost - please try again.`)
    } finally {
      setBusy(null)
    }
  }

  const style = doc ? RESULT_STYLE[doc.status] : null
  const preview = busy?.preview || (snap?.id === doc?.id ? snap?.url : null) || storedImage
  const v = doc?.verification

  return (
    <div className={`rounded-2xl border p-4 transition ${style && !busy ? style.ring : 'border-slate-200 bg-white'}`}>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="hidden" onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }} />
      <div className="flex gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) handleFile(e.dataTransfer.files[0]) }}
          onClick={() => !busy && !preview && inputRef.current?.click()}
          className={`relative flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 ${
            preview ? 'border-slate-200 bg-slate-900' : `cursor-pointer border-dashed ${dragOver ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-slate-50 hover:border-violet-400'}`
          }`}
        >
          {preview ? (
            <>
              <img src={preview} alt={`${label} snapshot`} className="h-full w-full object-contain" />
              {busy && (
                <>
                  <div className="doc-scan-tint" />
                  <div className="doc-scan-bar" />
                </>
              )}
            </>
          ) : (
            <div className="px-2 text-center text-slate-400">
              <UploadCloud size={26} className="mx-auto mb-1" />
              <p className="text-[11px] font-medium leading-tight">Drop a photo or PDF, or click</p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              {tag && <span className="text-[10px] font-semibold text-slate-400">{tag}</span>}
            </div>
            {style && !busy && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
                <style.Icon size={12} /> {style.label}
              </span>
            )}
          </div>

          {busy ? (
            <div className="mt-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-700">
                <ScanSearch size={14} /> Inspecting document…
              </p>
              <ul className="space-y-1">
                {spec.questions.map((q, i) => (
                  <li key={q.id} className={`flex items-center gap-1.5 text-xs ${i < busy.step ? 'text-slate-700' : 'text-slate-400'}`}>
                    {i < busy.step ? <CheckCircle2 size={12} className="text-cyan-600" /> : i === busy.step ? <Loader2 size={12} className="animate-spin" /> : <span className="h-3 w-3 rounded-full border border-slate-300" />}
                    {q.q.replaceAll('{{today}}', 'today').split('?')[0]}?
                  </li>
                ))}
              </ul>
            </div>
          ) : doc ? (
            <div className="mt-2 text-xs text-slate-600">
              <p className="flex flex-wrap items-center gap-1 text-slate-500">
                {doc.file.mime === 'application/pdf' ? <FileText size={12} /> : <FileImage size={12} />} {doc.file.name}
                {doc.file.mime === 'application/pdf' && ` · PDF, ${doc.file.pageCount} page${doc.file.pageCount === 1 ? '' : 's'}`} · quality {v.qualityScore}/100
              </p>
              {v.issues.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-slate-700">
                  {v.issues.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => inputRef.current?.click()} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${doc.status === 'rejected' ? 'bg-red-600 text-white hover:bg-red-700' : 'border border-slate-200 text-slate-600 hover:bg-white'}`}>
                  <RefreshCcw size={12} /> {doc.status === 'rejected' ? 'Upload a better copy' : 'Replace'}
                </button>
                <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
                  <Eye size={12} /> {open ? 'Hide' : 'Details'}
                </button>
                <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white">
                  <ExternalLink size={12} /> Open file
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-xs text-slate-500">{spec.description}</p>
              <button onClick={() => inputRef.current?.click()} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
                <UploadCloud size={13} /> Upload
              </button>
            </div>
          )}
          {locked && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleFile(locked.file, locked.password)
              }}
              className="mt-3 rounded-xl bg-amber-50 p-3"
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
                <Lock size={14} /> {locked.incorrect ? 'That password did not work — try again.' : 'This PDF is password-protected.'}
              </p>
              <p className="mt-1 text-xs text-amber-800">
                For e-Aadhaar it is the first 4 letters of your name in CAPITALS followed by your year of birth, e.g. RAVI1990.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  type="password"
                  value={locked.password}
                  onChange={(e) => setLocked((l) => ({ ...l, password: e.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="PDF password"
                />
                <button type="submit" disabled={!locked.password} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  Unlock
                </button>
                <button type="button" onClick={() => setLocked(null)} className="rounded-lg px-2 py-2 text-sm text-amber-800">
                  Cancel
                </button>
              </div>
            </form>
          )}
          {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      </div>

      {open && v && !busy && (
        <div className="mt-4 grid gap-4 border-t border-slate-200/70 pt-4 text-xs sm:grid-cols-2">
          <div>
            <p className="mb-1.5 font-semibold text-slate-700">Checks</p>
            <ul className="space-y-1">
              {v.answers.map((a) => (
                <li key={a.id} className="flex gap-1.5">
                  {a.answer ? <CheckCircle2 size={13} className="mt-px shrink-0 text-green-600" /> : <XCircle size={13} className={`mt-px shrink-0 ${a.passed ? 'text-slate-300' : 'text-red-500'}`} />}
                  <span className="text-slate-600">{a.question}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-slate-700">Read from document</p>
            <dl className="space-y-0.5">
              {Object.entries(v.extracted || {}).map(([k, val]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-32 shrink-0 capitalize text-slate-400">{k.replaceAll('_', ' ')}</dt>
                  <dd className="text-slate-700">{val ?? '—'}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[10px] text-slate-400">Verified by {v.model} on {new Date(v.verifiedAt).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  )
}
