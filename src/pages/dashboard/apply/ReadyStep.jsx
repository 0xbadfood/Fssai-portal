import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, PhoneCall, RotateCcw, Send } from 'lucide-react'
import { BigButton } from './ApplyPage.jsx'

export default function ReadyStep({ app, flow, r }) {
  const navigate = useNavigate()
  if (app.status !== 'ready') {
    return (
      <div className="rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm sm:p-10">
        <p className="text-5xl">🚀</p>
        <h2 className="mt-3 text-3xl font-extrabold text-slate-900">All set to submit</h2>
        <p className="mx-auto mt-2 max-w-lg text-lg text-slate-600">
          Your {r.kind === 'A' ? 'Form A' : 'Form B'} and documents are complete. Pay the government fee and we'll file it on the FSSAI portal for you.
        </p>
        <BigButton tone="green" className="mt-6" disabled={flow.busy || !r.ready} onClick={() => navigate('/dashboard/payments')}>
          <Send size={20} /> Pay the government fee and submit
        </BigButton>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-6 text-white shadow-lg sm:p-10">
        <CheckCircle2 size={48} />
        <h2 className="mt-3 text-3xl font-extrabold">Submitted to our team 🎉</h2>
        <p className="mt-2 text-lg text-white/90">
          Reference <b className="font-mono">{app.id.slice(0, 8).toUpperCase()}</b> · {r.e.licence}
        </p>
      </div>
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
          <PhoneCall className="text-sky-500" /> What happens next
        </h3>
        <ol className="mt-4 space-y-3 text-lg text-slate-700">
          <li>1. Our operations team will call you on <b>{app.info.mobile}</b>.</li>
          <li>2. Keep your phone handy: FoSCoS sends you an <b>OTP</b> to confirm the filing.</li>
          <li>3. We'll share the FSSAI application number once it's filed.</li>
        </ol>
      </div>
      <div className="flex flex-wrap gap-3">
        <BigButton tone="white" onClick={() => navigate('/dashboard/overview')}>
          Go to dashboard
        </BigButton>
        <BigButton tone="white" disabled={flow.busy} onClick={flow.startNew}>
          <RotateCcw size={18} /> Start another application
        </BigButton>
      </div>
    </div>
  )
}
