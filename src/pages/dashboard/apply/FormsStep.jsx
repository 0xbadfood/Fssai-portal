import React from 'react'
import { ArrowRight, Pencil, Printer } from 'lucide-react'
import { buildForm } from '../../../lib/applicationPlan.js'
import { DOC_TYPES } from '../../../lib/documents.js'
import { BigButton } from './ApplyPage.jsx'

export default function FormsStep({ app, flow, docs, go }) {
  const labels = Object.fromEntries(Object.entries(DOC_TYPES).map(([k, v]) => [k, v.label]))
  const form = buildForm(app, docs, labels)
  const gaps = form.sections.flatMap((s) => s.rows).filter(([, v]) => v == null).length

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-emerald-50 p-5 text-lg text-emerald-900">
        ✨ We filled in your <b>{form.kind === 'A' ? 'Form A' : 'Form B'}</b> from your answers and documents. Give it a quick look.
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
        <div className="rounded-t-3xl border-b-4 border-double border-slate-300 bg-slate-50 px-6 py-5 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Food Safety and Standards (Licensing and Registration of Food Businesses) Regulations</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">{form.title}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {form.sections.map((s, i) => (
            <div key={s.title} className="px-6 py-5">
              <h3 className="mb-3 text-base font-extrabold uppercase tracking-wide text-slate-500">
                {i + 1}. {s.title}
              </h3>
              <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-[minmax(0,14rem),1fr]">
                {s.rows.map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="text-base text-slate-500">{k}</dt>
                    <dd className={`text-base font-semibold ${v == null ? 'text-red-600' : 'text-slate-900'}`}>{v ?? 'Missing'}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <BigButton tone="green" disabled={flow.busy || gaps > 0} onClick={() => go('ready')}>
          Looks good <ArrowRight size={20} />
        </BigButton>
        <BigButton tone="white" disabled={flow.busy} onClick={() => go('details')}>
          <Pencil size={18} /> Change details
        </BigButton>
        <BigButton tone="white" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </BigButton>
      </div>
    </div>
  )
}
