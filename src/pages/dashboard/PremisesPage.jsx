import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Plus } from 'lucide-react'
import { useCurrentApplication } from '../../lib/applications.js'
import { LOCATIONS_LABEL, QUESTIONS } from '../../lib/intakeQuestions.js'
import { eligibilityFromFacts } from '../../lib/applicationPlan.js'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'

export default function PremisesPage() {
  const { app } = useCurrentApplication()
  if (app === undefined) return <Loading />
  const facts = app?.facts || {}
  const info = app?.info || {}
  const place = QUESTIONS.find((q) => q.id === 'place')
  const e = eligibilityFromFacts(facts)
  const address = [info.premises_address, info.city, info.pincode, info.state || (facts.states || [])[0]].filter(Boolean).join(', ')
  const several = facts.locations === 'many' || facts.locations === 'multistate'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader emoji="📍" title="Premises" subtitle="Every place where you make, store, serve or sell food needs its own FSSAI registration or licence." />

      {!facts.place ? (
        <Card className="text-center">
          <p className="text-4xl">🏪</p>
          <p className="mt-3 text-xl font-extrabold text-slate-900">No premises yet</p>
          <p className="mt-1 text-slate-500">Your premises are added while you answer a few questions about your business.</p>
          <Link to="/dashboard/apply" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">
            Start my application <ArrowRight size={18} />
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
                <MapPin size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">{place.show(facts)}</p>
                <p className="text-lg font-extrabold text-slate-900">{info.legal_name || 'Your business'}</p>
                <p className="mt-1 text-slate-600">{address || 'Address not added yet'}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
              {e.licence && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{e.licence}</span>}
              <span className={`rounded-full px-3 py-1 ${app.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {app.status === 'ready' ? 'With our team for filing' : 'Application in progress'}
              </span>
            </div>
            {!info.premises_address && (
              <Link to="/dashboard/apply" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-violet-600 hover:gap-2">
                Add the address in your application <ArrowRight size={14} />
              </Link>
            )}
          </Card>

          <Link
            to="/dashboard/support?topic=premises"
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center transition hover:border-violet-400 hover:bg-violet-50"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm">
              <Plus size={22} />
            </span>
            <p className="mt-3 text-lg font-extrabold text-slate-900">Another place of business?</p>
            <p className="mt-1 text-sm text-slate-500">
              {several
                ? `You told us: ${LOCATIONS_LABEL[facts.locations].toLowerCase()}. Our team will set up an application for each one.`
                : 'Tell us about it and our team will set up its application.'}
            </p>
          </Link>
        </div>
      )}
    </div>
  )
}
