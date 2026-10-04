import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Loader2, MapPin, Plus } from 'lucide-react'
import { applicationStage, groupByBusiness, newApplication, useApplications } from '../../lib/applications.js'
import { selectApplication, useSelectedApplicationId } from '../../lib/selectedApplication.js'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'

/** Every premises, by business (as in My applications): each place has its own application, licence and fee. */
export default function PremisesPage() {
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
  const addPremises = async (fromId) => {
    setBusy(fromId)
    setFailed('')
    try {
      await newApplication({ anotherPremisesOf: fromId })
      navigate('/dashboard/apply')
    } catch (e) {
      setFailed(e.message)
      setBusy(null)
    }
  }
  const businesses = groupByBusiness(list)

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader emoji="📍" title="Premises" subtitle="Every place where you make, store, serve or sell food needs its own FSSAI registration or licence." />

      {(error || failed) && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error || failed}</p>}

      {businesses.length === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">🏪</p>
          <p className="mt-3 text-xl font-extrabold text-slate-900">No premises yet</p>
          <p className="mt-1 text-slate-500">Your premises are added while you answer a few questions about your business.</p>
          <Link to="/dashboard/apply" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700">
            Start my application <ArrowRight size={18} />
          </Link>
        </Card>
      ) : (
        businesses.map((b) => {
          // New premises copy the business details from its most recent application.
          const from = [...b.rows].reverse().find((a) => a.status !== 'pending') || b.rows[b.rows.length - 1]
          return (
            <section key={b.rows[0].id} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-extrabold capitalize text-slate-900">{b.name || 'New business (name not entered yet)'}</h2>
                  <p className="text-sm text-slate-500">{[b.entityType, `${b.rows.length} premises`].filter(Boolean).join(' · ')}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {b.rows.map((a) => {
                  const s = applicationStage(a)
                  const address = [a.premises.address, a.premises.city, a.premises.pincode, a.premises.state].filter(Boolean).join(', ')
                  return (
                    <button
                      key={a.id}
                      onClick={() => open(a.id)}
                      className={`rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:border-violet-300 sm:p-6 ${a.id === selected ? 'border-violet-300 ring-2 ring-violet-100' : 'border-slate-100'}`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                          <MapPin size={22} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-500">{a.place || 'Kind of place not answered yet'}</p>
                          <p className={`text-lg font-extrabold ${address ? 'text-slate-900' : 'text-slate-400'}`}>{address || 'Address not entered yet'}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {a.licence && <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{a.licence}</span>}
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${s.tone}`}>
                          {s.Icon && <s.Icon size={13} />} {s.text}
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 font-bold text-violet-700">
                          Open <ArrowRight size={14} />
                        </span>
                      </div>
                    </button>
                  )
                })}

                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center">
                  <p className="text-lg font-extrabold text-slate-900">Another place for this business?</p>
                  <p className="mt-1 text-sm text-slate-500">Each place needs its own application. We fill in the business details for you.</p>
                  <button
                    onClick={() => addPremises(from.id)}
                    disabled={!!busy}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy === from.id ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add premises
                  </button>
                </div>
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
