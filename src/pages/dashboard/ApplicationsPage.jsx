import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Clock, Loader2, MapPinPlus, Plus } from 'lucide-react'
import { Card, Loading, PageHeader } from '../../components/dashboard/ui.jsx'
import { newApplication, useApplications } from '../../lib/applications.js'
import { selectApplication, useSelectedApplicationId } from '../../lib/selectedApplication.js'

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

// Where an application is, in the customer's words.
function stage(a) {
  if (a.case) return { text: a.case.arn ? `${a.case.label} · ARN ${a.case.arn}` : a.case.label, tone: 'bg-emerald-50 text-emerald-700' }
  if (a.status === 'ready') return { text: 'Submitted', tone: 'bg-emerald-50 text-emerald-700' }
  if (a.status === 'pending') return { text: 'Pending: not started', tone: 'bg-amber-50 text-amber-800', Icon: Clock }
  if (a.ready) return { text: 'Ready to pay and submit', tone: 'bg-violet-50 text-violet-700' }
  return { text: 'In progress', tone: 'bg-sky-50 text-sky-700' }
}

// "Sharma Foods Pvt. Ltd." and "M/s Sharma Foods" are one business.
const LEGAL = new Set(['pvt', 'private', 'ltd', 'limited', 'llp', 'co', 'company', 'm', 's', 'the', 'and'])
const businessKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !LEGAL.has(w))
    .join(' ')

/**
 * Applications by business: an application added for another premises stays with the one it came from; the rest
 * group by business name. One without a name yet is a business of its own. Most recently active business first.
 */
function groupByBusiness(list) {
  const byId = Object.fromEntries(list.map((a) => [a.id, a]))
  const root = (a) => {
    let x = a
    while (x.parentId && byId[x.parentId] && x.parentId !== x.id) x = byId[x.parentId]
    return x
  }
  const groups = new Map()
  for (const a of [...list].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt))) {
    const r = root(a)
    const key = businessKey(r.business || a.business) || `new:${r.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(a)
  }
  const latest = (rows) => Math.max(...rows.map((a) => new Date(a.updatedAt || a.createdAt).getTime()))
  return [...groups.values()]
    .map((rows) => ({
      rows,
      name: rows.find((a) => a.business)?.business || null,
      entityType: rows.find((a) => a.entityType)?.entityType || null,
      applicant: rows.find((a) => a.applicant)?.applicant || null,
    }))
    .sort((x, y) => latest(y.rows) - latest(x.rows))
}

/** "My applications": one table per business, one row per premises (each place needs its own registration or licence). */
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
  const create = async (anotherPremisesOf, key) => {
    setBusy(key)
    setFailed('')
    try {
      await newApplication({ anotherPremisesOf })
      navigate('/dashboard/apply')
    } catch (e) {
      setFailed(e.message)
      setBusy(null)
    }
  }
  const businesses = groupByBusiness(list)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader emoji="🗂️" title="My applications" subtitle="Your businesses and their premises. Every shop, kitchen, unit or warehouse needs its own FSSAI registration or licence.">
        <button
          onClick={() => create(null, 'new')}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
        >
          {busy === 'new' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add a new business
        </button>
      </PageHeader>

      {(error || failed) && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error || failed}</p>}

      {businesses.length === 0 ? (
        <Card className="text-center text-slate-600">You haven't started an application yet.</Card>
      ) : (
        businesses.map((b) => {
          // New premises copy the business details from its most recent application.
          const from = [...b.rows].reverse().find((a) => a.status !== 'pending') || b.rows[b.rows.length - 1]
          return (
            <Card key={b.rows[0].id} className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
                    <Building2 size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold capitalize text-slate-900">{b.name || 'New business (name not entered yet)'}</p>
                    <p className="text-sm text-slate-500">
                      {[b.entityType, b.applicant, `${b.rows.length} premises`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => create(from.id, from.id)}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
                >
                  {busy === from.id ? <Loader2 size={15} className="animate-spin" /> : <MapPinPlus size={15} />} Add premises
                </button>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 sm:px-6">Premises</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Licence</th>
                    <th className="hidden px-3 py-2.5 lg:table-cell">Fee</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-5 py-2.5 sm:px-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.rows.map((a) => {
                    const s = stage(a)
                    const address = [a.premises.address, a.premises.city, a.premises.state].filter(Boolean).join(', ')
                    return (
                      <tr key={a.id} onClick={() => open(a.id)} className={`cursor-pointer align-top hover:bg-violet-50/50 ${a.id === selected ? 'bg-violet-50/70' : ''}`}>
                        <td className="px-5 py-3.5 sm:px-6">
                          <p className={`font-semibold ${address ? 'text-slate-900' : 'text-slate-400'}`}>{address || 'Address not entered yet'}</p>
                          <p className="text-xs text-slate-500">
                            {a.place || 'Kind of place not answered yet'}
                            <span className="md:hidden">{a.licence ? ` · ${a.licence}` : ''}</span>
                          </p>
                        </td>
                        <td className="hidden px-3 py-3.5 text-slate-700 md:table-cell">{a.licence || '—'}</td>
                        <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">{a.fee != null ? `${rupees(a.fee)}/yr` : '—'}</td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${s.tone}`}>
                            {s.Icon && <s.Icon size={12} />} {s.text}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right sm:px-6">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap font-bold text-violet-700">
                            {a.status === 'ready' ? 'View' : a.status === 'pending' ? 'Start' : 'Continue'} <ArrowRight size={14} />
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {b.rows.some((a) => a.status === 'pending') && (
                <p className="border-t border-slate-100 bg-amber-50/60 px-5 py-2.5 text-xs text-amber-900 sm:px-6">
                  Pending: added because you said you run this business from more than one place. Its business details are filled in; add the
                  place's address and documents.
                </p>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
