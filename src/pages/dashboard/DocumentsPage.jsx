import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lock } from 'lucide-react'
import DocumentUploadCard from '../../components/documents/DocumentUploadCard.jsx'
import { DOC_TYPES, useUserDocuments } from '../../lib/documents.js'
import { useCurrentApplication } from '../../lib/applications.js'
import { isDocOk, readiness } from '../../lib/applicationPlan.js'
import { PageHeader } from '../../components/dashboard/ui.jsx'

export default function DocumentsPage() {
  const { docs, put } = useUserDocuments()
  const { app } = useCurrentApplication()
  const r = app ? readiness(app, docs) : null
  const needed = r?.docs || []
  const neededIds = needed.map((d) => d.id)
  const others = Object.keys(DOC_TYPES).filter((id) => !neededIds.includes(id))
  const required = needed.filter((d) => !d.optional)
  const done = required.filter((d) => isDocOk(docs[d.id])).length
  const pct = required.length ? Math.round((done / required.length) * 100) : 0

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader emoji="📂" title="Document Vault" subtitle="Upload once and reuse. Our AI checks every photo or PDF straight away and tells you if it's good to go.">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-100">
          <Lock size={14} className="text-emerald-500" /> Only you and our team can see these
        </span>
      </PageHeader>

      {needed.length > 0 && (
        <section className="space-y-3">
          <div className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 ring-1 ring-amber-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-extrabold text-amber-900">Needed for your {r.e.licence}</p>
              <span className="text-base font-extrabold text-amber-900">{done}/{required.length} ready</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {app?.status !== 'ready' && done === required.length && (
              <Link to="/dashboard/apply" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-amber-900 hover:gap-2">
                All in, continue your application <ArrowRight size={14} />
              </Link>
            )}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {needed.map((d) => (
              <DocumentUploadCard key={d.id} docTypeId={d.id} label={`${DOC_TYPES[d.id].label}${d.optional ? ' (optional)' : ''}`} tag={d.why} doc={docs[d.id]} onSave={put} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-900">{needed.length ? 'Other documents' : 'Your documents'}</h2>
        <p className="text-sm text-slate-500">Not needed for your current application, but handy to keep here for later filings.</p>
        <div className="grid gap-3 xl:grid-cols-2">
          {others.map((id) => (
            <DocumentUploadCard key={id} docTypeId={id} label={DOC_TYPES[id].label} doc={docs[id]} onSave={put} />
          ))}
        </div>
      </section>
    </div>
  )
}
