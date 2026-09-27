import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, FileText, FolderUp, MessageCircle, PartyPopper, Pencil, Plus, Send } from 'lucide-react'
import { DOC_TYPES } from '../../../lib/documents.js'
import { BigButton } from './ApplyPage.jsx'
import ChatControls from './ChatControls.jsx'

const VERDICT_STYLE = {
  registration: { bg: 'from-emerald-500 to-lime-500', emoji: '🌱', blurb: 'The simplest one — for small food businesses.' },
  central_registration: { bg: 'from-teal-500 to-emerald-500', emoji: '🚉', blurb: 'Registration on the central route, for small businesses at railway, airport or central-government premises.' },
  state: { bg: 'from-orange-500 to-amber-500', emoji: '🏢', blurb: 'For medium-sized food businesses, issued by your state.' },
  central: { bg: 'from-violet-600 to-fuchsia-500', emoji: '🏛️', blurb: 'Issued by FSSAI centrally — for large or special-category businesses.' },
}
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

// The result and the summary rows come from the server (graph rules); nothing is worked out here.
export default function SummaryStep({ app, flow, r, go }) {
  const e = r.result
  const kind = r.kind
  const required = r.docs.filter((d) => !d.optional)
  const style = VERDICT_STYLE[e.licenceId]

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
      ) : e.outcome === 'handover' || !style ? (
        <div className="rounded-3xl bg-gradient-to-br from-slate-700 to-violet-700 p-6 text-white shadow-lg sm:p-8">
          <p className="text-5xl">🧑‍⚖️</p>
          <h2 className="mt-3 text-3xl font-extrabold">An expert will place your business</h2>
          <p className="mt-2 text-lg text-white/90">Your answers don't fit a standard FSSAI category exactly, so our FSSAI expert will confirm which licence you need.</p>
          <ul className="mt-4 space-y-1 text-base text-white/85">
            {[...e.handover, ...e.reasons].map((x) => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
          <Link to="/services?head=licensing-approvals" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-lg font-bold text-violet-700 shadow hover:bg-violet-50">
            <MessageCircle size={20} /> Talk to an expert
          </Link>
        </div>
      ) : (
        <div className={`rounded-3xl bg-gradient-to-br ${style.bg} p-6 text-white shadow-lg sm:p-8`}>
          <p className="text-base font-semibold text-white/85">Based on your answers, you need</p>
          <h2 className="mt-1 flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            <span>{style.emoji}</span> {e.licence}
          </h2>
          <p className="mt-2 text-lg text-white/90">{style.blurb}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Application form" value={kind === 'A' ? 'Form A' : 'Form B'} note="We fill it for you" />
            <Stat label="Government fee" value={e.fee ? rupees(e.fee) : 'No fee'} note={e.fee ? 'per year' : 'for this registration'} />
            <Stat label="Documents" value={required.length} note="photos to upload" />
          </div>
          <ul className="mt-5 space-y-1 text-base text-white/90">
            {e.reasons.map((x) => (
              <li key={x}>• {x}</li>
            ))}
          </ul>
          {e.handover.length > 0 && (
            <div className="mt-4 rounded-2xl bg-white/15 p-4 text-base">
              <p className="font-bold">An expert will confirm:</p>
              <ul className="mt-1 space-y-1 text-white/90">
                {e.handover.map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          )}
          {e.outcome === 'optin' && (
            <button onClick={() => flow.update({ optInRegistration: false })} className="mt-3 text-sm font-semibold text-white underline">
              Actually, I don't want to apply
            </button>
          )}
        </div>
      )}

      {e.tasks.length > 0 && (
        <div className="space-y-3">
          {e.tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-4 rounded-3xl border border-violet-100 bg-violet-50/60 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
                <Plus size={20} />
              </span>
              <div>
                <p className="text-lg font-extrabold text-slate-900">
                  {t.label}
                  {t.licence && <span className="ml-2 text-base font-semibold text-violet-700">{t.licence}{t.fee ? `, ${rupees(t.fee)}/year` : ''}</span>}
                </p>
                <p className="mt-1 text-base text-slate-600">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResultCheck flow={flow} provisional={e.provisional} />

      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
        <h3 className="text-xl font-extrabold text-slate-900">What I understood</h3>
        <p className="text-base text-slate-500">Something wrong? Tap it to change — the result updates instantly.</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {app.intake.summary.map((row) => (
            <button
              key={row.id}
              disabled={flow.busy}
              onClick={() => flow.reask(row.id)}
              className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <span>
                <span className="block text-sm text-slate-500">{row.title}</span>
                <span className="block text-base font-bold text-slate-800">{row.value}</span>
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
            <Step n={2} icon={FolderUp} tone="bg-amber-100 text-amber-600" title="Upload photos" text={required.map((d) => DOC_TYPES[d.id].label).join(', ')} />
            <Step n={3} icon={FileText} tone="bg-emerald-100 text-emerald-600" title={`${kind === 'A' ? 'Form A' : 'Form B'} ready`} text="Filled automatically — just check it" />
            <Step n={4} icon={Send} tone="bg-sky-100 text-sky-600" title="We submit" text="Our team files it and calls you for the OTP" />
          </div>
          {r.filingCall.length > 0 && (
            <p className="mt-4 text-sm text-slate-500">
              We'll prepare these with you on the filing call: {r.filingCall.map((d) => d.label.replace(/ \(on letterhead\)$/, '')).join('; ')}.
            </p>
          )}
          <BigButton className="mt-6 w-full sm:w-auto" disabled={flow.busy} onClick={() => go('details')}>
            Let's start <ArrowRight size={20} />
          </BigButton>
        </div>
      )}

      {!kind && e.outcome !== 'handover' && (
        <p className="flex items-center gap-2 text-base text-slate-500">
          <PartyPopper size={18} /> Nothing more to do. You can change your answers above any time.
        </p>
      )}
    </div>
  )
}

/** "Is this right?" on the result, logged for the expert's review. */
function ResultCheck({ flow, provisional }) {
  const [sent, setSent] = useState(null)
  const rate = (rating) => {
    setSent(rating)
    flow.rate(rating)
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
      {sent ? (
        <p className="text-base font-semibold text-slate-600">Thanks! {sent === 'right' ? '🙏' : 'Our expert will take a look.'}</p>
      ) : (
        <>
          <p className="text-base font-bold text-slate-800">Is this right?</p>
          {[['right', '👍 Yes'], ['wrong', '👎 No'], ['unsure', '🤔 Not sure']].map(([id, label]) => (
            <button key={id} onClick={() => rate(id)} className="rounded-2xl border-2 border-slate-200 px-4 py-2 text-base font-bold text-slate-700 hover:border-violet-300">
              {label}
            </button>
          ))}
        </>
      )}
      {provisional && <p className="w-full text-sm text-slate-400">Worked out from the FoSCoS 2026 eligibility table. Our FSSAI expert is still reviewing these rules.</p>}
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
