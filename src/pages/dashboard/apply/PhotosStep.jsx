import React from 'react'
import { ArrowRight } from 'lucide-react'
import DocumentUploadCard from '../../../components/documents/DocumentUploadCard.jsx'
import { DOC_TYPES } from '../../../lib/documents.js'
import { docFacts, isDocOk } from '../../../lib/applicationPlan.js'
import { BigButton } from './ApplyPage.jsx'

const PHOTOS = [
  { id: 'identity', label: 'Your photo ID', why: 'Aadhaar, PAN, Voter ID, Passport or Driving Licence' },
  { id: 'address', label: 'Electricity bill of your premises', why: 'A recent bill for the place where you run the business' },
]
const READ_LABELS = { applicant_name: 'Name', premises_address: 'Address', city: 'City', pincode: 'PIN code', state: 'State' }

export default function PhotosStep({ flow, docs, putDoc, go }) {
  const read = docFacts(docs)
  const done = PHOTOS.every((p) => isDocOk(docs[p.id]))

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-pink-50 p-5 sm:p-7">
        <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Let's start with 2 photos 📸</h2>
        <p className="mt-2 text-lg text-slate-600">
          We read your name and address from them, so you type less later. Take a clear photo, or upload the PDF if you have one (e-Aadhaar, e-bill).
        </p>
      </div>

      <div className="space-y-3">
        {PHOTOS.map((p) => (
          <DocumentUploadCard key={p.id} docTypeId={p.id} label={p.label || DOC_TYPES[p.id].label} tag={p.why} doc={docs[p.id]} onSave={putDoc} />
        ))}
      </div>

      {Object.keys(read).length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="text-xl font-extrabold text-slate-900">What we read</h3>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[8rem,1fr]">
            {Object.entries(READ_LABELS)
              .filter(([k]) => read[k])
              .map(([k, label]) => (
                <React.Fragment key={k}>
                  <dt className="text-base text-slate-500">{label}</dt>
                  <dd className="text-lg font-bold text-slate-900">{read[k].value}</dd>
                </React.Fragment>
              ))}
          </dl>
          <p className="mt-3 text-sm text-slate-500">You can correct anything later in the Details step.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <BigButton disabled={flow.busy} onClick={() => go('intake')} tone={done ? 'violet' : 'white'}>
          {done ? 'Continue' : 'Skip for now'} <ArrowRight size={20} />
        </BigButton>
        {!done && <p className="text-base text-slate-500">You can add them later — we'll ask again at the Documents step.</p>}
      </div>
    </div>
  )
}
