import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, Download, ExternalLink, Loader2, Lock, Mail, MessageSquarePlus, Pencil, Phone, UploadCloud, XCircle } from 'lucide-react'
import { DOC_TYPES, PdfPasswordError, prepareFile } from '../../lib/documents.js'
import { BackToQueue } from './OpsLayout.jsx'

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const show = (v) => (Array.isArray(v) ? v.join(', ') : v == null || v === '' ? '—' : String(v))

async function api(path, body) {
  const res = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export default function OpsCasePage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const base = `/api/ops/cases/${id}`

  useEffect(() => {
    api(base).then(setData).catch((e) => setError(e.message))
  }, [id])

  /** Run a case action; the server answers with the updated case. */
  async function act(path, body) {
    setBusy(true)
    setError('')
    try {
      const next = await api(`${base}/${path}`, body || {}) // always a POST, even with nothing to send
      // take / transfer answer with the queue; fetch the case again.
      setData(next.case ? next : await api(base))
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <div className="flex justify-center py-20 text-slate-400">{error ? <p className="text-red-600">{error}</p> : <Loader2 className="animate-spin" />}</div>

  const c = data.case
  const statusLabel = Object.fromEntries(data.statuses.map((s) => [s.id, s.label]))
  const names = Object.fromEntries(data.members.map((m) => [m.id, m.name]))

  return (
    <div className="space-y-4">
      <BackToQueue />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold text-slate-500">CASE {c.ref}</p>
          <h1 className="text-2xl font-extrabold text-slate-900">{data.info.legal_name || data.customer.businessName || data.customer.name}</h1>
          <p className="text-sm text-slate-500">
            {data.info.applicant_name || data.customer.name} · opened {when(c.openedAt)}
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700 ring-1 ring-violet-100">{statusLabel[c.status]}</span>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),360px]">
        <div className="min-w-0 space-y-4">
          <ResultCard result={data.result} />
          {data.crossCheck.length > 0 && <CrossCheck rows={data.crossCheck} />}
          <Section title="Documents" note="Our review overrides the AI check either way. A rejection asks the customer for a new copy, with your reason.">
            <div className="space-y-3">
              {data.documents.map((d) => (
                <DocCard key={d.docTypeId} row={d} base={base} busy={busy} act={act} />
              ))}
              {data.otherDocuments.length > 0 && <p className="pt-2 text-xs font-bold uppercase tracking-wide text-slate-400">Also uploaded (not required)</p>}
              {data.otherDocuments.map((d) => (
                <DocCard key={d.docTypeId} row={d} base={base} busy={busy} act={act} />
              ))}
            </div>
          </Section>
          <FoscosChecklist data={data} base={base} busy={busy} act={act} />
          <Details data={data} busy={busy} act={act} />
          <Answers data={data} />
        </div>

        <div className="space-y-4">
          <CaseControls data={data} busy={busy} act={act} />
          <Section title="Customer">
            <p className="font-bold text-slate-900">{data.customer.name}</p>
            {data.customer.businessName && <p className="text-sm text-slate-500">{data.customer.businessName}</p>}
            <div className="mt-2 space-y-1 text-sm">
              <a href={`tel:${data.info.mobile || data.customer.phone}`} className="flex items-center gap-2 font-semibold text-violet-700 hover:underline">
                <Phone size={14} /> {data.info.mobile || data.customer.phone}
              </a>
              <a href={`mailto:${data.customer.email}`} className="flex items-center gap-2 text-violet-700 hover:underline">
                <Mail size={14} /> {data.customer.email}
              </a>
            </div>
            {data.payment && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                Paid {rupees(data.payment.amount)} · {data.payment.method} · <span className="font-mono text-xs">{data.payment.reference}</span>
                {data.payment.mode === 'test' && <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-xs font-bold text-sky-700">TEST</span>}
              </p>
            )}
          </Section>
          <Timeline events={data.events} names={names} statusLabel={statusLabel} busy={busy} act={act} />
        </div>
      </div>
    </div>
  )
}

function Section({ title, note, children, right }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
          {note && <p className="text-xs text-slate-500">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function ResultCard({ result: e }) {
  if (!e) return null
  return (
    <Section title="Licence">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-xl font-extrabold text-slate-900">{e.licence || (e.outcome === 'handover' ? 'Expert to place' : e.outcome)}</p>
        {e.form && <span className="text-sm font-semibold text-slate-600">Form {e.form}</span>}
        {e.fee != null && <span className="text-sm font-semibold text-slate-600">{rupees(e.fee)}/year</span>}
        {e.provisional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Provisional rules</span>}
      </div>
      {e.kinds.length > 0 && <p className="mt-1 text-sm text-slate-600">Kinds of business: {e.kinds.join(', ')}</p>}
      <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
        {e.reasons.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      {e.tasks.map((t) => (
        <p key={t.id} className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <b>+ {t.label}</b>
          {t.licence ? ` (${t.licence}${t.fee ? `, ${rupees(t.fee)}/yr` : ''})` : ''}: {t.text}
        </p>
      ))}
      {e.handover.length > 0 && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <b>Expert to confirm:</b> {e.handover.join(' · ')}
        </div>
      )}
    </Section>
  )
}

const MARK = {
  match: { text: 'Match', tone: 'text-emerald-700 bg-emerald-50' },
  close: { text: 'Close', tone: 'text-amber-800 bg-amber-50' },
  mismatch: { text: 'Mismatch', tone: 'text-red-700 bg-red-50' },
}

function CrossCheck({ rows }) {
  return (
    <Section title="Cross-check" note="The application's details against what was read from the accepted documents. Mismatches don't stop the customer: check them with them on the filing call.">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-400">
          <tr>
            <th className="pb-1 font-semibold">Detail</th>
            <th className="pb-1 font-semibold">Application</th>
            <th className="pb-1 font-semibold">Document</th>
            <th className="pb-1" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label} className="align-top">
              <td className="py-1.5 pr-2 font-semibold text-slate-600">{r.label}</td>
              <td className="py-1.5 pr-2 text-slate-800">{show(r.application)}</td>
              <td className="py-1.5 pr-2 text-slate-800">
                {show(r.document)} <span className="text-xs text-slate-400">({r.source})</span>
              </td>
              <td className="py-1.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MARK[r.result].tone}`}>{MARK[r.result].text}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

const AI = {
  accepted: { text: 'AI: accepted', tone: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 },
  review: { text: 'AI: unsure', tone: 'bg-amber-50 text-amber-800', Icon: AlertTriangle },
  rejected: { text: 'AI: rejected', tone: 'bg-red-50 text-red-700', Icon: XCircle },
}

/** One document: preview, the AI's verdict and evidence, what it read, our review, and upload on the customer's behalf. */
function DocCard({ row, base, busy, act }) {
  const d = row.doc
  const v = d?.verification
  const [open, setOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const input = useRef(null)
  const [upload, setUpload] = useState(null) // { state: 'reading' | 'checking' | 'password', file, password, error }

  async function send(file, password) {
    setUpload({ state: 'reading', file })
    let prepared
    try {
      prepared = await prepareFile(file, password)
    } catch (e) {
      if (e instanceof PdfPasswordError) return setUpload({ state: 'password', file, password: '', error: e.incorrect ? e.message : '' })
      return setUpload({ state: 'error', error: e.message })
    }
    setUpload({ state: 'checking', file })
    const ok = await act('upload', { docTypeId: row.docTypeId, pages: prepared.pages, original: prepared.original, pdfText: prepared.pdfText, pageCount: prepared.pageCount, fileName: file.name, sizeBytes: file.size })
    setUpload(ok ? null : { state: 'error', error: 'Upload failed.' })
  }

  const ai = d ? AI[d.status] : null
  return (
    <div className={`rounded-xl border p-3 ${d?.opsStatus === 'approved' ? 'border-emerald-200' : d?.opsStatus === 'rejected' ? 'border-red-200' : 'border-slate-200'}`}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" className="hidden" onChange={(e) => { if (e.target.files[0]) send(e.target.files[0]); e.target.value = '' }} />
      <div className="flex gap-3">
        <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
          {d ? <img src={`${base}/documents/${d.id}/preview`} alt={`${row.label} preview`} className="h-full w-full object-contain" /> : <span className="px-2 text-center text-[11px] text-slate-400">Not uploaded</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-bold text-slate-900">{row.label}</p>
            {row.required && <span className="text-xs font-semibold text-slate-400">required</span>}
            {row.optional && <span className="text-xs font-semibold text-slate-400">optional</span>}
            {ai && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${ai.tone}`}>
                <ai.Icon size={11} /> {ai.text}
              </span>
            )}
            {d?.opsStatus && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d.opsStatus === 'approved' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                {d.opsStatus === 'approved' ? 'Approved' : 'Rejected'}
                {d.opsReviewedBy ? ` by ${d.opsReviewedBy}` : ''}
              </span>
            )}
            {d?.pdfEncrypted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                <Lock size={11} /> PDF password
              </span>
            )}
          </div>
          {row.why && <p className="text-xs text-slate-500">{row.why}</p>}
          {d && (
            <p className="mt-1 text-xs text-slate-500">
              {d.file.name} · {v?.detectedType || '—'} · quality {v?.qualityScore ?? '—'}/100 · {when(d.uploadedAt)}
              {d.uploadedByName && ` · uploaded by ${d.uploadedByName}`}
            </p>
          )}
          {d?.opsStatus === 'rejected' && d.opsNote && <p className="mt-1 text-xs font-semibold text-red-700">Reason sent to the customer: {d.opsNote}</p>}
          {d && !d.opsStatus && v?.issues?.length > 0 && <p className="mt-1 text-xs text-amber-800">{v.issues.join(' ')}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {d && (
              <>
                <a href={`${base}/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <ExternalLink size={12} /> Open file
                </a>
                <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {open ? 'Hide AI details' : 'AI details'}
                </button>
                {d.opsStatus !== 'approved' && (
                  <button disabled={busy} onClick={() => act(`documents/${d.id}/review`, { decision: 'approved' })} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40">
                    Approve
                  </button>
                )}
                {d.opsStatus !== 'rejected' && (
                  <button disabled={busy} onClick={() => setRejecting(true)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-40">
                    Reject
                  </button>
                )}
              </>
            )}
            <button disabled={busy || !!upload} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <UploadCloud size={12} /> {d ? 'Replace for customer' : 'Upload for customer'}
            </button>
          </div>

          {rejecting && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's wrong? The customer sees this." className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
              <button
                disabled={busy || !reason.trim()}
                onClick={async () => {
                  if (await act(`documents/${d.id}/review`, { decision: 'rejected', note: reason })) {
                    setRejecting(false)
                    setReason('')
                  }
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                Reject
              </button>
              <button onClick={() => setRejecting(false)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          )}
          {upload?.state === 'password' && (
            <form onSubmit={(e) => { e.preventDefault(); send(upload.file, upload.password) }} className="mt-2 flex flex-wrap gap-1.5">
              <input autoFocus type="password" value={upload.password} onChange={(e) => setUpload({ ...upload, password: e.target.value })} placeholder="PDF password (not stored)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
              <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">Open</button>
              {upload.error && <p className="w-full text-xs text-red-600">{upload.error}</p>}
            </form>
          )}
          {(upload?.state === 'reading' || upload?.state === 'checking') && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
              <Loader2 size={12} className="animate-spin" /> {upload.state === 'reading' ? 'Reading the file…' : 'The AI is checking it…'}
            </p>
          )}
          {upload?.state === 'error' && <p className="mt-2 text-xs text-red-600">{upload.error}</p>}

          {open && v && (
            <div className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-2.5 text-xs sm:grid-cols-2">
              <ul className="space-y-1">
                {(v.answers || []).map((a) => (
                  <li key={a.id} className={a.passed ? 'text-slate-700' : 'text-red-700'}>
                    {a.answer ? '✓' : '✗'} {a.question.replace(/\s*\(.*?\)\??$/, '?')} <span className="text-slate-500">— {a.evidence}</span>
                  </li>
                ))}
              </ul>
              <dl className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5">
                {Object.entries(v.extracted || {}).map(([k, val]) => (
                  <React.Fragment key={k}>
                    <dt className="text-slate-400">{k.replaceAll('_', ' ')}</dt>
                    <dd className="text-slate-800">{show(val)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read this file.'))
    r.readAsDataURL(file)
  })

/**
 * The FoSCoS checklist: one row per document slot on FoSCoS, in FoSCoS's wording, with the file the team will
 * upload there (the customer's own copy, or one the team prepared), or the slot marked not applicable.
 */
function FoscosChecklist({ data, base, busy, act }) {
  const rows = data.foscos
  if (!rows.length) return null
  const done = rows.filter((r) => r.file).length
  const { types, maxMb } = data.foscosRules
  return (
    <Section
      title="FoSCoS documents"
      note={`What goes into each document slot on FoSCoS, in its order and wording. One file per slot: ${types}, up to ${maxMb} MB.`}
      right={<span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${done === rows.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{done} of {rows.length} ready</span>}
    >
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <SlotRow key={r.id} n={i + 1} row={r} base={base} busy={busy} act={act} maxMb={maxMb} />
        ))}
      </ol>
    </Section>
  )
}

function SlotRow({ n, row, base, busy, act, maxMb }) {
  const f = row.file
  const input = useRef(null)
  const [na, setNa] = useState(null) // reason being typed, or null
  const [error, setError] = useState('')
  const set = (body) => act(`foscos/${row.id}`, body)

  async function upload(file) {
    setError('')
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) return setError('FoSCoS takes PDF, JPG or PNG only.')
    if (file.size > maxMb * 1024 * 1024) return setError(`This file is larger than ${maxMb} MB, the FoSCoS limit. Compress it first.`)
    try {
      await set({ file: await readDataUrl(file), fileName: file.name }) // a server refusal shows at the top of the page
    } catch (e) {
      setError(e.message)
    }
  }

  const state = f?.kind === 'file' ? 'ready' : f?.kind === 'na' ? 'na' : row.optional ? 'optional' : 'needed'
  const chip = {
    ready: ['Ready', 'bg-emerald-50 text-emerald-700'],
    na: ['Not applicable', 'bg-slate-100 text-slate-500'],
    optional: ['Optional', 'bg-slate-100 text-slate-500'],
    needed: ['Needed', 'bg-amber-50 text-amber-800'],
  }[state]
  return (
    <li className={`rounded-xl border p-3 ${state === 'ready' ? 'border-emerald-200' : 'border-slate-200'}`}>
      <input ref={input} type="file" accept="application/pdf,.pdf,image/jpeg,image/png" className="hidden" onChange={(e) => { if (e.target.files[0]) upload(e.target.files[0]); e.target.value = '' }} />
      <div className="flex gap-3">
        <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs font-bold text-slate-400">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{row.slot || row.label}</p>
              {row.slot && row.slot !== row.label && <p className="text-xs text-slate-500">{row.label}</p>}
              {row.other && <p className="text-xs font-semibold text-violet-700">Not a slot of its own on FoSCoS: upload it under "Other documents".</p>}
              {row.tip && <p className="text-xs text-violet-700">{row.tip}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${chip[1]}`}>{chip[0]}</span>
          </div>

          {f?.kind === 'file' && (
            <p className="mt-1.5 text-xs text-slate-600">
              <b>{f.fileName}</b> · {(f.sizeBytes / 1024 / 1024).toFixed(2)} MB · {f.fromCustomer ? "customer's copy" : 'prepared by the team'}
              {f.addedBy && ` · ${f.addedBy}`} · {when(f.addedAt)}
            </p>
          )}
          {f?.kind === 'na' && <p className="mt-1.5 text-xs text-slate-600">Not applicable: {f.note}{f.addedBy && ` (${f.addedBy})`}</p>}
          {!f && row.naLikely && <p className="mt-1.5 text-xs font-semibold text-amber-800">Looks not applicable: {row.na}.</p>}

          {!f && row.feeds.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {row.feeds.map((x) => (
                <li key={x.docTypeId} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500">Customer's {x.label.toLowerCase()}:</span>
                  {!x.doc ? (
                    <span className="text-slate-400">not uploaded yet</span>
                  ) : (
                    <>
                      <a href={`${base}/documents/${x.doc.id}/file`} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-700 hover:underline">
                        {x.doc.fileName}
                      </a>
                      {!x.doc.ok ? (
                        <span className="text-red-700">rejected</span>
                      ) : x.doc.problem ? (
                        <span className="text-amber-800">{x.doc.problem}</span>
                      ) : (
                        <button disabled={busy} onClick={() => set({ useDocument: x.doc.id })} className="rounded-md bg-violet-600 px-2 py-0.5 font-bold text-white disabled:opacity-40">
                          Use this
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
              {row.feeds.length > 1 && <li className="text-xs text-slate-500">FoSCoS wants these as one file: combine them and upload the result.</li>}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {f?.kind === 'file' && (
              <>
                <a href={`${base}/foscos-files/${f.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <ExternalLink size={12} /> Open
                </a>
                <a href={`${base}/foscos-files/${f.id}?download`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Download size={12} /> Download
                </a>
              </>
            )}
            <button disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <UploadCloud size={12} /> {f?.kind === 'file' ? 'Replace' : 'Upload file'}
            </button>
            {f?.kind !== 'na' && na == null && (
              <button disabled={busy} onClick={() => setNa(row.naLikely ? row.na : '')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <Ban size={12} /> Not applicable
              </button>
            )}
            {f && (
              <button disabled={busy} onClick={() => set({ clear: true })} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                Clear
              </button>
            )}
          </div>
          {na != null && (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (await set({ notApplicable: na })) setNa(null)
              }}
              className="mt-2 flex flex-wrap gap-1.5"
            >
              <input autoFocus value={na} onChange={(e) => setNa(e.target.value)} placeholder="Why it doesn't apply (for the log)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
              <button disabled={busy || !na.trim()} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                Mark
              </button>
              <button type="button" onClick={() => setNa(null)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </li>
  )
}

/** Form A/B details; each correction is logged with the old value. */
function Details({ data, busy, act }) {
  const [editing, setEditing] = useState(null)
  const [value, setValue] = useState('')
  const sections = [...new Set(data.fields.map((f) => f.section))]
  const start = (f) => {
    setEditing(f.id)
    setValue(Array.isArray(data.info[f.id]) ? data.info[f.id].join(', ') : data.info[f.id] || '')
  }
  const save = async (f) => {
    const v = f.type === 'multichoice' ? value.split(',').map((x) => x.trim()).filter(Boolean) : value
    if (await act('detail', { field: f.id, value: v })) setEditing(null)
  }
  return (
    <Section title="Details (Form A/B)" note={data.missingFields.length ? `Missing: ${data.missingFields.length}` : 'All details filled in.'}>
      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={sec}>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">{sec}</p>
            <dl className="divide-y divide-slate-100">
              {data.fields
                .filter((f) => f.section === sec)
                .map((f) => (
                  <div key={f.id} className="grid gap-1 py-1.5 sm:grid-cols-[14rem,1fr]">
                    <dt className="text-sm text-slate-500">{f.label}</dt>
                    <dd className="text-sm">
                      {editing === f.id ? (
                        <span className="flex flex-wrap gap-1.5">
                          {f.type === 'choice' ? (
                            <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1">
                              <option value="">—</option>
                              {(f.options || []).map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1" placeholder={f.type === 'multichoice' ? 'Comma separated' : ''} />
                          )}
                          <button disabled={busy} onClick={() => save(f)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40">
                            Save
                          </button>
                          <button onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => start(f)} className={`group flex items-center gap-1.5 text-left font-semibold ${data.missingFields.includes(f.id) ? 'text-red-600' : 'text-slate-800'}`}>
                          {data.missingFields.includes(f.id) ? 'Missing' : show(data.info[f.id])}
                          <Pencil size={12} className="text-slate-300 group-hover:text-violet-600" />
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Answers({ data }) {
  return (
    <Section title="Intake answers">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[14rem,1fr]">
        {data.summary.map((r) => (
          <React.Fragment key={r.id}>
            <dt className="text-sm text-slate-500">{r.title}</dt>
            <dd className="text-sm font-semibold text-slate-800">{r.value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {data.typed.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Typed by the customer</p>
          <ul className="space-y-1 text-sm">
            {data.typed.map((t, i) => (
              <li key={i}>
                <span className="text-slate-500">{t.question}</span> — "{t.answer}" <span className="text-xs text-slate-400">({t.clarify ? 'unclear, then tapped' : `read by ${t.layer}`})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}

function CaseControls({ data, busy, act }) {
  const c = data.case
  const [status, setStatus] = useState(c.status)
  const [note, setNote] = useState('')
  const [to, setTo] = useState('')
  useEffect(() => setStatus(c.status), [c.status])
  const others = data.members.filter((m) => m.id !== c.assignee?.id)
  return (
    <Section title="Case">
      <p className="text-sm text-slate-500">Owner</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-900">{c.assignee ? (c.assignee.id === data.me.id ? 'Me' : c.assignee.name) : 'Nobody yet'}</span>
        {c.assignee?.id !== data.me.id && (
          <button disabled={busy} onClick={() => act('take')} className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40">
            Take it
          </button>
        )}
      </div>
      {others.length > 0 && (
        <div className="mb-3 flex gap-1.5">
          <select value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="">Transfer to…</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button disabled={!to || busy} onClick={async () => (await act('transfer', { to })) && setTo('')} className="rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700 disabled:opacity-40">
            Move
          </button>
        </div>
      )}
      <p className="text-sm text-slate-500">Status</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
        {data.statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the log (optional)" className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
      <button disabled={busy || status === c.status} onClick={async () => (await act('status', { status, note })) && setNote('')} className="mt-1.5 w-full rounded-lg bg-slate-900 py-1.5 text-sm font-bold text-white disabled:opacity-30">
        Update status
      </button>
    </Section>
  )
}

function describe(e, names, statusLabel) {
  const d = e.detail || {}
  const who = e.actor || 'System'
  const doc = (t) => DOC_TYPES[t]?.label || t
  switch (e.kind) {
    case 'opened':
      return `Case opened: paid ${rupees(d.amount ?? 0)}${d.mode === 'test' ? ' (test)' : ''}${d.reference ? ` · ${d.reference}` : ''}`
    case 'taken':
      return `${who} took the case`
    case 'transferred':
      return `${who} moved it to ${names[d.to] || 'another member'}${d.note ? `: "${d.note}"` : ''}`
    case 'status':
      return `${who}: ${statusLabel[d.from] || d.from} → ${statusLabel[d.to] || d.to}${d.note ? `: "${d.note}"` : ''}`
    case 'detail_changed':
      return `${who} changed ${d.label}: ${show(d.from)} → ${show(d.to)}`
    case 'document_reviewed':
      return `${who} ${d.decision} ${doc(d.docType)}${d.note ? `: "${d.note}"` : ''}`
    case 'document_uploaded':
      return `${who} uploaded ${doc(d.docType)} for the customer (AI: ${d.ai})`
    case 'document_viewed':
      return `${who} opened ${d.fileName}`
    case 'foscos_file':
      return d.action === 'cleared'
        ? `${who} cleared the FoSCoS file for ${d.label}`
        : d.action === 'not_applicable'
          ? `${who} marked ${d.label} not applicable: "${d.note}"`
          : `${who} set the FoSCoS file for ${d.label}: ${d.fileName}${d.action === 'customer_copy' ? " (customer's copy)" : ''}`
    case 'case_viewed':
      return `${who} opened the case`
    default:
      return `${who}: ${e.kind}`
  }
}

/** Notes and everything that happened, newest first. Views are the access log (hidden unless asked for). */
function Timeline({ events, names, statusLabel, busy, act }) {
  const [text, setText] = useState('')
  const [access, setAccess] = useState(false)
  const list = events.filter((e) => access || !['case_viewed', 'document_viewed'].includes(e.kind))
  return (
    <Section
      title="Timeline"
      right={
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={access} onChange={(e) => setAccess(e.target.checked)} /> Access log
        </label>
      }
    >
      <div className="flex gap-1.5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Internal note (the customer never sees it)" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <button disabled={busy || !text.trim()} onClick={async () => (await act('note', { text })) && setText('')} className="self-end rounded-lg bg-violet-600 p-2 text-white disabled:opacity-40" aria-label="Add note">
          <MessageSquarePlus size={16} />
        </button>
      </div>
      <ol className="mt-3 space-y-2.5">
        {list.map((e) => (
          <li key={e.id} className={`text-sm ${e.kind === 'note' ? 'rounded-lg bg-amber-50 px-2.5 py-1.5' : ''}`}>
            <p className="text-xs text-slate-400">{when(e.at)}</p>
            {e.kind === 'note' ? (
              <p className="text-slate-800">
                <b>{e.actor}:</b> {e.detail?.text}
              </p>
            ) : (
              <p className={['case_viewed', 'document_viewed'].includes(e.kind) ? 'text-slate-400' : 'text-slate-700'}>{describe(e, names, statusLabel)}</p>
            )}
          </li>
        ))}
      </ol>
    </Section>
  )
}
