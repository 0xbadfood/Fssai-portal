import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, Loader2, MapPin, MapPinPlus, Plus } from 'lucide-react'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'
import { applicationName, newApplication, useApplications } from '../../lib/applications.js'
import { selectApplication, useSelectedApplicationId } from '../../lib/selectedApplication.js'

// Where an application is, in the customer's words.
function stage(a) {
  if (a.case) return { text: a.case.arn ? `${a.case.label} · ARN ${a.case.arn}` : a.case.label, tone: 'bg-emerald-50 text-emerald-700' }
  if (a.status === 'ready') return { text: 'Submitted', tone: 'bg-emerald-50 text-emerald-700' }
  if (a.status === 'pending') return { text: 'Pending: not started', tone: 'bg-amber-50 text-amber-800' }
  if (a.ready) return { text: 'Ready to pay and submit', tone: 'bg-violet-50 text-violet-700' }
  return { text: 'In progress', tone: 'bg-sky-50 text-sky-700' }
}

/** "My applications": one per premises (each needs its own registration or licence), newest first. */
export default function ApplicationsPage() {
  const navigate = useNavigate()
  const { list, error } = useApplications()
  const selected = useSelectedApplicationId()
  const [busy, setBusy] = useState(null)
  const [failed, setFailed] = useState('')
  if (list === undefined) return <Loading />

  const open = (id) => {
    selectApplication(id)
    navigate('/dashboard/apply')
  }
  const create = async (anotherPremisesOf) => {
    setBusy(anotherPremisesOf || 'new')
    setFailed('')
    try {
      await newApplication({ anotherPremisesOf })
      navigate('/dashboard/apply')
    } catch (e) {
      setFailed(e.message)
      setBusy(null)
    }
  }
  const byId = Object.fromEntries(list.map((a) => [a.id, a]))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader emoji="🗂️" title="My applications" subtitle="One application for every shop, kitchen, unit or warehouse: each place needs its own FSSAI registration or licence.">
        <button
          onClick={() => create(null)}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {busy === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Start a new application
        </button>
      </PageHeader>

      {(error || failed) && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error || failed}</p>}

      {list.length === 0 ? (
        <Card className="text-center text-slate-600">You haven't started an application yet.</Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const s = stage(a)
            const place = [a.premises.address, a.premises.city, a.premises.state].filter(Boolean).join(', ')
            const from = a.parentId && byId[a.parentId]
            return (
              <Card key={a.id} className={`${a.id === selected ? 'ring-2 ring-violet-300' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold text-slate-900">{a.business || 'New application'}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
                      <MapPin size={14} className="shrink-0 text-slate-400" /> {place || 'Premises not entered yet'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {a.licence || 'Licence not worked out yet'} · started {new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {from && ` · another place of ${applicationName(from)}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.tone}`}>
                    {a.status === 'pending' && <Clock size={12} />} {s.text}
                  </span>
                </div>
                {a.status === 'pending' && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Added because you said you run your business from more than one place. Your business details are filled in; add this place's
                    address and documents.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => open(a.id)} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700">
                    {a.status === 'ready' ? 'View' : a.status === 'pending' ? 'Start' : 'Continue'} <ArrowRight size={15} />
                  </button>
                  {a.status !== 'pending' && (
                    <button
                      onClick={() => create(a.id)}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
                    >
                      {busy === a.id ? <Loader2 size={15} className="animate-spin" /> : <MapPinPlus size={15} />} Add another premises
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
