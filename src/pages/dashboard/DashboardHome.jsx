import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileText, FolderOpen, MapPin, PhoneCall } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { useCurrentApplication } from '../../lib/applications.js'
import { useUserDocuments } from '../../lib/documents.js'
import { GOVT_FEE_PER_YEAR, isDocOk, readiness } from '../../lib/applicationPlan.js'
import { QUESTIONS } from '../../lib/intakeQuestions.js'
import { SERVICES } from '../../lib/services.js'
import { Card, Loading } from '../../components/dashboard/ui.jsx'

const STEP_ORDER = ['photos', 'intake', 'summary', 'details', 'documents', 'forms', 'ready']
const STEP_LABEL = { photos: 'Photos', intake: 'Your business', summary: 'Your licence', details: 'Details', documents: 'Documents', forms: 'Forms', ready: 'Submit' }

// After our team has the application; later stages are updated by the operations team as the filing moves.
const JOURNEY = [
  { title: 'Submitted & paid', text: 'Application complete and government fee paid.' },
  { title: 'Filing call', text: 'Our team calls you for the FoSCoS OTP.' },
  { title: 'Filed on FoSCoS', text: 'You get the 17-digit FSSAI application number.' },
  { title: 'FSSAI review', text: 'Scrutiny, and an inspection where applicable.' },
  { title: 'Licence granted', text: 'Valid permanently under the 2026 rules; no renewals.' },
]

export default function DashboardHome() {
  const { session } = useAuth()
  const { app } = useCurrentApplication()
  const { docs } = useUserDocuments()
  const firstName = session?.name?.split(' ')[0] || 'there'
  if (app === undefined) return <Loading />

  const r = app ? readiness(app, docs) : null
  const ready = app?.status === 'ready'
  const stepIdx = app ? STEP_ORDER.indexOf(app.step) : -1
  const pct = ready ? 100 : Math.max(5, Math.round((stepIdx / (STEP_ORDER.length - 1)) * 100))
  const place = QUESTIONS.find((q) => q.id === 'place')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-6 text-white shadow-xl shadow-violet-200 sm:p-9">
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10" />
        <p className="relative text-lg font-semibold text-white/90">Namaste {firstName} 👋</p>
        {ready ? (
          <>
            <h1 className="relative mt-1 text-3xl font-extrabold sm:text-4xl">Your application is with our team 🎉</h1>
            <p className="relative mt-2 max-w-2xl text-lg text-white/90">
              We'll call you on <b>{app.info?.mobile || session?.phone}</b> to file it on FoSCoS. Keep your phone handy for the OTP.
            </p>
            <Link to="/dashboard/apply" className="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-violet-700 shadow hover:bg-violet-50">
              <FileText size={18} /> View my application
            </Link>
          </>
        ) : (
          <>
            <h1 className="relative mt-1 text-3xl font-extrabold sm:text-4xl">
              {app && stepIdx > 0 ? "Let's finish your licence application" : "Let's find the licence you need"}
            </h1>
            <div className="relative mt-4 max-w-md">
              <div className="flex justify-between text-sm font-semibold text-white/85">
                <span>Next: {STEP_LABEL[app?.step] || 'Photos'}</span>
                <span>{app ? pct : 0}%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${app ? pct : 0}%` }} />
              </div>
            </div>
            <Link to="/dashboard/apply" className="relative mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-violet-700 shadow hover:bg-violet-50">
              {app && stepIdx > 0 ? 'Continue' : 'Start now'} <ArrowRight size={18} />
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Tile
          to="/dashboard/apply"
          emoji="🏛️"
          label="Your licence"
          value={r?.intakeDone ? r.e.licence || 'Not needed' : 'Not worked out yet'}
          note={r?.intakeDone && r.e.licence ? `Form ${r.kind} · govt fee from ₹${GOVT_FEE_PER_YEAR[r.e.licence].toLocaleString('en-IN')}/year` : 'A few taps to find out'}
        />
        <Tile
          to="/dashboard/documents"
          emoji="📂"
          label="Documents"
          value={r?.docs.length ? `${r.docs.filter((d) => !d.optional && isDocOk(docs[d.id])).length} of ${r.docs.filter((d) => !d.optional).length} ready` : `${Object.values(docs).filter(isDocOk).length} uploaded`}
          note={r?.missingDocs.length ? `Still needed: ${r.missingDocs.length}` : r?.docs.length ? 'All required documents in' : 'Kept safe in your vault'}
        />
        <Tile
          to="/dashboard/premises"
          emoji="📍"
          label="Premises"
          value={app?.info?.city || (app?.facts?.place ? place.show(app.facts) : 'Not added yet')}
          note={app?.info?.premises_address || (app?.facts?.states || []).join(', ') || 'Added during your application'}
        />
      </div>

      <Card>
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
          <PhoneCall size={20} className="text-violet-500" /> What happens next
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-5">
          {JOURNEY.map((s, i) => {
            const done = ready && i === 0
            const current = ready ? i === 1 : i === 0
            return (
              <li key={s.title} className="relative">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${
                    done ? 'bg-emerald-500 text-white' : current ? 'bg-violet-600 text-white ring-4 ring-violet-100' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? <CheckCircle2 size={18} /> : i + 1}
                </span>
                <p className={`mt-2 text-sm font-extrabold ${done || current ? 'text-slate-900' : 'text-slate-400'}`}>{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.text}</p>
              </li>
            )
          })}
        </ol>
      </Card>

      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Our experts can also help with</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.slice(1).map((s) => (
            <Link
              key={s.title}
              to={`/dashboard/support?topic=${s.topic}`}
              className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <s.icon size={20} />
              </span>
              <p className="mt-3 font-extrabold text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.points.join(' · ')}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-violet-600 group-hover:gap-2">
                Ask an expert <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function Tile({ to, emoji, label, value, note }) {
  return (
    <Link to={to} className="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-3xl">{emoji}</span>
        <ArrowRight size={16} className="text-slate-300 transition group-hover:text-violet-500" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{label}</p>
      <p className="text-xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 truncate text-sm text-slate-500">{note}</p>
    </Link>
  )
}
