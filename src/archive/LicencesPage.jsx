import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileEdit, ShieldCheck, XCircle, Plus } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { licences } from '../../lib/mockData.js'
import { STATUS } from '../../lib/eligibility.js'

export default function LicencesPage() {
  const [selectedId, setSelectedId] = useState(licences[0].id)
  const selected = licences.find((l) => l.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrations &amp; Licences</h1>
          <p className="mt-1 text-sm text-slate-500">All your FSSAI applications, registrations and licences in one place.</p>
        </div>
        <Link to="/dashboard/apply" className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus size={15} /> New Application
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
          {licences.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition ${
                selectedId === l.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{l.kind}</p>
                <p className="truncate font-mono text-xs text-slate-400">{l.reference}</p>
                <p className="mt-0.5 text-xs text-slate-500">{l.premise}</p>
              </div>
              <StatusBadge status={l.status} />
            </button>
          ))}
        </div>

        {selected && <LicenceDetail licence={selected} />}
      </div>
    </div>
  )
}

function LicenceDetail({ licence }) {
  return (
    <div className="h-fit rounded-2xl border border-slate-100 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{licence.kind}</h2>
          <p className="mt-0.5 font-mono text-xs text-slate-400">{licence.reference}</p>
        </div>
        <StatusBadge status={licence.status} />
      </div>

      <dl className="mt-5 space-y-3 text-sm">
        <Row label="Kind of Business" value={licence.kob.join(', ')} />
        <Row label="Premise" value={licence.premise} />
        <Row label="Validity" value={licence.validity} />
      </dl>

      {licence.status === STATUS.CLARIFICATION_REQUESTED && (
        <div className="mt-4 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
          A clarification has been requested by the authority for this application. See{' '}
          <Link to="/dashboard/notices" className="font-semibold underline">
            Notices
          </Link>{' '}
          for details.
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionBtn icon={ShieldCheck} label="View Details" />
        {licence.granted && <ActionBtn icon={Download} label="Download Certificate" />}
        <ActionBtn icon={FileEdit} label="Apply for Modification" />
        {licence.granted && <ActionBtn icon={XCircle} label="Surrender" danger />}
      </div>

      {licence.granted && (
        <p className="mt-4 text-[11px] text-slate-400">
          Under the 2026 framework, granted approvals have perpetual validity and do not require periodic renewal.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  )
}

function ActionBtn({ icon: Icon, label, danger }) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
        danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={13} /> {label}
    </button>
  )
}
