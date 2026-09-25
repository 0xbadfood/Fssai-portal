import React from 'react'
import { ArrowRight } from 'lucide-react'
import DocumentUploadCard from '../../../components/documents/DocumentUploadCard.jsx'
import { DOC_TYPES } from '../../../lib/documents.js'
import { isDocOk } from '../../../lib/applicationPlan.js'
import { BigButton } from './ApplyPage.jsx'

export default function DocumentsStep({ flow, r, docs, putDoc, go }) {
  const required = r.docs.filter((d) => !d.optional)
  const done = required.filter((d) => isDocOk(docs[d.id])).length
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
            label={`${DOC_TYPES[d.id].label}${d.optional ? ' (optional)' : ''}`}
            tag={d.why}
            doc={docs[d.id]}
            onSave={putDoc}
          />
        ))}
      </div>

      <BigButton disabled={flow.busy || r.missingDocs.length > 0} onClick={() => go('forms')}>
        See my {r.kind === 'A' ? 'Form A' : 'Form B'} <ArrowRight size={20} />
      </BigButton>
    </div>
  )
}
