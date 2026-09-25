import React from 'react'
import { ArrowRight, ClipboardList, FileText, FolderUp, PartyPopper, Pencil, Send } from 'lucide-react'
import { LICENCE } from '../../../lib/eligibility.js'
import { QUESTIONS, titleFor } from '../../../lib/intakeQuestions.js'
import { GOVT_FEE_PER_YEAR, requiredDocuments } from '../../../lib/applicationPlan.js'
import { DOC_TYPES } from '../../../lib/documents.js'
import { BigButton } from './ApplyPage.jsx'
import ChatControls from './ChatControls.jsx'

const VERDICT_STYLE = {
  [LICENCE.REGISTRATION]: { bg: 'from-emerald-500 to-lime-500', emoji: '🌱', blurb: 'The simplest one — for small food businesses.' },
  [LICENCE.STATE]: { bg: 'from-orange-500 to-amber-500', emoji: '🏢', blurb: 'For medium-sized food businesses, issued by your state.' },
  [LICENCE.CENTRAL]: { bg: 'from-violet-600 to-fuchsia-500', emoji: '🏛️', blurb: 'Issued by FSSAI centrally — for large or special-category businesses.' },
}

export default function SummaryStep({ app, flow, r, go }) {
  const { e, kind } = r
  const facts = app.facts
  const answered = QUESTIONS.filter((q) => q.relevant(facts) && q.answered(facts))

  return (
    <div className="space-y-5">
      {e.outcome === 'notfood' ? (
        <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-500 p-6 text-white shadow-lg sm:p-8">
          <p className="text-5xl">👍</p>
          <h2 className="mt-3 text-3xl font-extrabold">You don't need FSSAI approval</h2>
          <p className="mt-2 text-lg text-white/90">{e.reasons[0]}</p>
          <p className="mt-2 text-base text-white/80">{e.guidance}</p>
        </div>
      ) : e.outcome === 'deemed' ? (
        <div className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-500 p-6 text-white shadow-lg sm:p-8">
          <p className="text-5xl">🎉</p>
          <h2 className="mt-3 text-3xl font-extrabold">Good news — you don't need to apply!</h2>
          <p className="mt-2 text-lg text-white/90">{e.reasons[0]}</p>
          <p className="mt-2 text-base text-white/80">{e.guidance}</p>
          <div className="mt-5 rounded-2xl bg-white/15 p-4 text-base">
            <p>{e.upsell}</p>
            <BigButton tone="white" className="mt-3" disabled={flow.busy} onClick={() => flow.update({ optInRegistration: true })}>
              Apply for FSSAI Registration anyway
            </BigButton>
          </div>
        </div>
      ) : (
        <div className={`rounded-3xl bg-gradient-to-br ${VERDICT_STYLE[e.licence].bg} p-6 text-white shadow-lg sm:p-8`}>
          <p className="text-base font-semibold text-white/85">Based on your answers, you need</p>
          <h2 className="mt-1 flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            <span>{VERDICT_STYLE[e.licence].emoji}</span> {e.licence}
          </h2>
          <p className="mt-2 text-lg text-white/90">{VERDICT_STYLE[e.licence].blurb}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Application form" value={kind === 'A' ? 'Form A' : 'Form B'} note="We fill it for you" />
            <Stat label="Government fee" value={`from ₹${GOVT_FEE_PER_YEAR[e.licence].toLocaleString('en-IN')}`} note="per year" />
            <Stat label="Documents" value={requiredDocuments(facts, e).filter((d) => !d.optional).length} note="photos to upload" />
          </div>
          <ul className="mt-5 space-y-1 text-base text-white/90">
            {e.reasons.map((x) => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
          {e.outcome === 'optin' && (
            <button onClick={() => flow.update({ optInRegistration: false })} className="mt-3 text-sm font-semibold text-white underline">
              Actually, I don't want to apply
            </button>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
        <h3 className="text-xl font-extrabold text-slate-900">What I understood</h3>
        <p className="text-base text-slate-500">Something wrong? Tap it to change — the result updates instantly.</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {answered.map((q) => (
            <button
              key={q.id}
              disabled={flow.busy}
              onClick={() => flow.reask(q.id)}
              className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <span>
                <span className="block text-sm text-slate-500">{titleFor(q, facts)}</span>
                <span className="block text-base font-bold text-slate-800">{q.show(facts)}</span>
              </span>
              <Pencil size={18} className="shrink-0 text-slate-400 group-hover:text-violet-600" />
            </button>
          ))}
        </div>
        <div className="mt-5">
          <ChatControls app={app} flow={flow} />
        </div>
      </div>

      {kind && (
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
          <h3 className="text-xl font-extrabold text-slate-900">Apply in 4 simple steps</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Step n={1} icon={ClipboardList} tone="bg-orange-100 text-orange-600" title="A few details" text="Mostly taps — we've pre-filled what we know" />
            <Step n={2} icon={FolderUp} tone="bg-amber-100 text-amber-600" title="Upload photos" text={requiredDocuments(facts, e).filter((d) => !d.optional).map((d) => DOC_TYPES[d.id].label).join(', ')} />
            <Step n={3} icon={FileText} tone="bg-emerald-100 text-emerald-600" title={`${kind === 'A' ? 'Form A' : 'Form B'} ready`} text="Filled automatically — just check it" />
            <Step n={4} icon={Send} tone="bg-sky-100 text-sky-600" title="We submit" text="Our team files it and calls you for the OTP" />
          </div>
          <BigButton className="mt-6 w-full sm:w-auto" disabled={flow.busy} onClick={() => go('details')}>
            Let's start <ArrowRight size={20} />
          </BigButton>
        </div>
      )}

      {!kind && (
        <p className="flex items-center gap-2 text-base text-slate-500">
          <PartyPopper size={18} /> Nothing more to do. You can change your answers above any time.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, note }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/75">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-sm text-white/80">{note}</p>
    </div>
  )
}

function Step({ n, icon: Icon, tone, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>
        <Icon size={22} />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-400">Step {n}</p>
      <p className="text-lg font-extrabold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  )
}
