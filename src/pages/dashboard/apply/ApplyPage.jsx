import React, { useEffect } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { useApplication } from '../../../lib/applications.js'
import { useUserDocuments } from '../../../lib/documents.js'
import { readiness } from '../../../lib/applicationPlan.js'
import PhotosStep from './PhotosStep.jsx'
import IntakeStep from './IntakeStep.jsx'
import SummaryStep from './SummaryStep.jsx'
import DetailsStep from './DetailsStep.jsx'
import DocumentsStep from './DocumentsStep.jsx'
import FormsStep from './FormsStep.jsx'
import ReadyStep from './ReadyStep.jsx'

const STEPS = [
  { id: 'photos', label: 'Photos', tone: 'bg-pink-500' },
  { id: 'intake', label: 'Your business', tone: 'bg-violet-500' },
  { id: 'summary', label: 'Your licence', tone: 'bg-fuchsia-500' },
  { id: 'details', label: 'Details', tone: 'bg-orange-500' },
  { id: 'documents', label: 'Documents', tone: 'bg-amber-500' },
  { id: 'forms', label: 'Forms', tone: 'bg-emerald-500' },
  { id: 'ready', label: 'Done', tone: 'bg-sky-500' },
]

export default function ApplyPage() {
  const flow = useApplication()
  const { docs, put } = useUserDocuments()
  const { app } = flow

  useEffect(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [app?.step])

  if (!app) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        {flow.error ? <p className="text-red-600">{flow.error}</p> : <Loader2 className="animate-spin" size={28} />}
      </div>
    )
  }

  const r = readiness(app, docs)
  const reachable = {
    photos: app.status !== 'ready',
    intake: app.status !== 'ready',
    summary: r.intakeDone && app.status !== 'ready',
    details: r.intakeDone && !!r.kind && app.status !== 'ready',
    documents: r.intakeDone && !!r.kind && !r.missing.length && app.status !== 'ready',
    forms: r.intakeDone && !!r.kind && !r.missing.length && !r.missingDocs.length && app.status !== 'ready',
    ready: app.status === 'ready' || r.ready,
  }
  const current = STEPS.findIndex((s) => s.id === app.step)
  const go = (step) => flow.update({ step })
  const props = { app, flow, r, docs, putDoc: put, go }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-6 text-white shadow-lg sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/10" />
        <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
          <Sparkles size={16} /> AI-powered FSSAI assistant
        </p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
          {app.status === 'ready' ? 'Your application is ready 🎉' : 'Get your food licence — just tap and go'}
        </h1>
        <div className="mt-5 flex flex-wrap gap-2">
          {STEPS.map((s, i) => {
            const done = i < current || app.status === 'ready'
            const active = s.id === app.step
            return (
              <button
                key={s.id}
                disabled={!reachable[s.id] || active || flow.busy}
                onClick={() => go(s.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                  active ? 'bg-white text-violet-700 shadow' : done ? 'bg-white/25 text-white hover:bg-white/35' : 'bg-white/10 text-white/60'
                }`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white ${active ? s.tone : done ? 'bg-white/30' : 'bg-white/15'}`}>
                  {done && !active ? <Check size={12} /> : i + 1}
                </span>
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {flow.error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{flow.error}</p>}

      {app.step === 'photos' && <PhotosStep {...props} />}
      {app.step === 'intake' && <IntakeStep {...props} />}
      {app.step === 'summary' && <SummaryStep {...props} />}
      {app.step === 'details' && <DetailsStep {...props} />}
      {app.step === 'documents' && <DocumentsStep {...props} />}
      {app.step === 'forms' && <FormsStep {...props} />}
      {app.step === 'ready' && <ReadyStep {...props} />}
    </div>
  )
}

export function BigButton({ children, className = '', tone = 'violet', ...rest }) {
  const tones = {
    violet: 'bg-violet-600 hover:bg-violet-700 shadow-violet-200',
    green: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
    white: 'bg-white !text-slate-700 border-2 border-slate-200 hover:bg-slate-50 shadow-none',
  }
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  )
}

export const CARD_TONES = [
  'from-orange-50 to-amber-100 border-orange-200 hover:border-orange-400',
  'from-sky-50 to-cyan-100 border-sky-200 hover:border-sky-400',
  'from-emerald-50 to-lime-100 border-emerald-200 hover:border-emerald-400',
  'from-fuchsia-50 to-pink-100 border-fuchsia-200 hover:border-fuchsia-400',
  'from-violet-50 to-indigo-100 border-violet-200 hover:border-violet-400',
]
