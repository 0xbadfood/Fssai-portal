import React from 'react'
import { ArrowRight } from 'lucide-react'
import DocumentUploadCard from '../../../components/documents/DocumentUploadCard.jsx'
import { DOC_TYPES, isDocOk } from '../../../lib/documents.js'
import { BigButton } from './ApplyPage.jsx'

// Every licence needs the photo ID, so it is the one photo asked for up front. A bill is optional here: it only
// lets us read the premises address. Whether address proof is required depends on the licence, so the
// Documents step asks for it when it is.
const READ_LABELS = { applicant_name: 'Name', premises_address: 'Address', city: 'City', pincode: 'PIN code', state: 'State' }

export default function PhotosStep({ flow, r, docs, putDoc, go }) {
  const read = r.readFromDocs
  const done = isDocOk(docs.identity)

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-pink-50 p-5 sm:p-7">
        <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Let's start with a photo of your ID 📸</h2>
        <p className="mt-2 text-lg text-slate-600">
          We read your name from it, so you type less later. Take a clear photo, or upload the PDF if you have one (e-Aadhaar).
        </p>
      </div>

      <DocumentUploadCard docTypeId="identity" label="Your photo ID" tag="Aadhaar, PAN, Voter ID, Passport or Driving Licence" doc={docs.identity} onSave={putDoc} />

      <div className="space-y-2">
        <p className="text-base text-slate-500">
          <b className="text-slate-700">Optional:</b> add a recent bill for your premises and we'll read the address from it too.
        </p>
        <DocumentUploadCard
          docTypeId="address"
          label={`${DOC_TYPES.address.label} (optional)`}
          tag="Electricity, water or phone bill, or a bank statement"
          doc={docs.address}
          onSave={putDoc}
        />
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
        {!done && <p className="text-base text-slate-500">You can add it later — we'll ask again at the Documents step.</p>}
      </div>
    </div>
  )
}
