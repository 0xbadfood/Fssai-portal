import React from 'react'
import { ArrowRight } from 'lucide-react'
import DocumentUploadCard from '../../../components/documents/DocumentUploadCard.jsx'
import { DOC_TYPES, isDocOk } from '../../../lib/documents.js'
import { BigButton } from './ApplyPage.jsx'

export default function DocumentsStep({ app, flow, r, docs, putDoc, go }) {
  const required = r.docs.filter((d) => !d.optional)
  // A document left for our team to collect counts as done here; the server's plan has the final say.
  const done = required.filter((d) => isDocOk(docs[d.id]) || d.deferred).length
  const deferredIds = r.docs.filter((d) => d.deferred).map((d) => d.id)
  const defer = (id) => (on) => flow.update({ info: { deferred_docs: on ? [...deferredIds, id] : deferredIds.filter((x) => x !== id) } })
  const pct = required.length ? Math.round((done / required.length) * 100) : 100

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-amber-50 p-5 sm:p-6">
        <p className="text-lg text-amber-900">
          📸 Take a clear photo of each document or upload its PDF — our AI checks it straight away and tells you if it's good to go.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-base font-extrabold text-amber-900">
            {done}/{required.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {r.docs.map((d) => (
          <DocumentUploadCard
            key={d.id}
            docTypeId={d.id}
            applicationId={app.id}
            label={`${DOC_TYPES[d.id].label}${d.optional ? ' (optional)' : ''}`}
            tag={d.why}
            doc={docs[d.id]}
            onSave={putDoc}
            deferred={d.deferred}
            onDefer={d.deferrable ? defer(d.id) : undefined}
            deferBusy={flow.busy}
          />
        ))}
      </div>

      {r.filingCall.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-extrabold text-slate-900">We'll prepare these with you on the filing call</h3>
          <p className="text-sm text-slate-500">Mostly short declarations on your letterhead. Nothing to upload now.</p>
          <ul className="mt-3 space-y-1.5 text-base text-slate-700">
            {r.filingCall.map((d) => (
              <li key={d.id}>• {d.label}</li>
            ))}
          </ul>
        </div>
      )}

      {r.toCollect?.length > 0 && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-base text-sky-900">
          🤝 You'll send {r.toCollect.length === 1 ? 'one document' : `${r.toCollect.length} documents`} to the MyFoodLicense team. We'll collect{' '}
          {r.toCollect.length === 1 ? 'it' : 'them'} from you before filing.
        </p>
      )}

      <BigButton disabled={flow.busy || r.missingDocs.length > 0} onClick={() => go('forms')}>
        See my {r.kind === 'A' ? 'Form A' : 'Form B'} <ArrowRight size={20} />
      </BigButton>
    </div>
  )
}
