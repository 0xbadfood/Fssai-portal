import React from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  CheckCircle2,
  Clock,
  BarChart3,
  ChevronRight,
  Building2,
  Landmark,
  RefreshCcw,
  Rocket,
  FolderOpen,
  Eye,
  Download,
  MapPin,
  Plus,
} from 'lucide-react'
import StatusBadge from '../StatusBadge.jsx'
import { liveApplication, documentVault, premises, recentActivity } from '../../lib/mockData.js'

const ICONS = { FileText, Building2, Landmark, RefreshCcw }
const TONE = {
  green: 'bg-green-50 text-green-600',
  orange: 'bg-orange-50 text-orange-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-blue-50 text-blue-600',
}
const KPI_ICON = { active: FileText, docs: CheckCircle2, pending: Clock, compliance: BarChart3 }
const KPI_TONE = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', orange: 'bg-orange-50 text-orange-600' }

export function KpiCards({ kpis }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((k) => {
        const Icon = KPI_ICON[k.id]
        return (
          <div key={k.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${KPI_TONE[k.tone]}`}>
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-slate-900">{k.value}</p>
              <p className="truncate text-xs font-medium text-slate-500">{k.label}</p>
              <p className="truncate text-[10px] text-slate-400">{k.hint}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LiveApplicationTracker() {
  const app = liveApplication
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Your Live Application</h3>
        </div>
        <Link to="/dashboard/licences" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
          View All Applications <ChevronRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">{app.type}</p>
          <p className="text-xs text-slate-400">{app.reference}</p>
        </div>
        <StatusBadge status={app.status} />
        <p className="text-xs text-slate-400">Submitted {app.submittedOn}</p>
      </div>
      <div className="mt-5 flex items-start overflow-x-auto pb-1">
        {app.steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div className="flex w-20 shrink-0 flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  s.done ? 'bg-green-500 text-white' : s.current ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span className="mt-1 text-[10px] font-medium leading-tight text-slate-600">{s.label}</span>
              {s.date && <span className="text-[9px] text-slate-400">{s.date}</span>}
            </div>
            {i < app.steps.length - 1 && <span className="mt-3 h-0.5 w-6 shrink-0 bg-slate-200" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const DOC_STATUS_TONE = {
  Verified: 'text-green-600',
  Uploaded: 'text-blue-600',
  'Action Needed': 'text-orange-600',
  'Not Required': 'text-slate-400',
}

export function DocumentVaultPreview() {
  const verified = documentVault.filter((d) => d.status === 'Verified' || d.status === 'Uploaded').length
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Document Vault</h3>
        </div>
        <span className="text-xs text-slate-400">{verified}/{documentVault.length} essential documents</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {documentVault.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="truncate text-slate-700">{d.label}</span>
            <span className={`shrink-0 text-[11px] font-semibold ${DOC_STATUS_TONE[d.status]}`}>{d.status}</span>
          </li>
        ))}
      </ul>
      <Link to="/dashboard/documents" className="mt-3 block text-center text-xs font-semibold text-blue-600 hover:underline">
        Open full Document Vault →
      </Link>
    </div>
  )
}

export function ApplicationFunnelChart({ data }) {
  const max = Math.max(...data.map((d) => d.value))
  const COLOR = { blue: '#2563eb', sky: '#38bdf8', orange: '#f97316', green: '#16a34a', red: '#ef4444' }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-blue-600" />
        <h3 className="text-sm font-bold text-slate-900">Application Funnel</h3>
        <span className="ml-auto text-xs text-slate-400">Last 6 months</span>
      </div>
      <div className="flex h-40 items-end gap-4">
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md"
                style={{ height: `${(d.value / max) * 100}%`, backgroundColor: COLOR[d.tone], minHeight: 6 }}
              />
            </div>
            <span className="text-sm font-bold text-slate-800">{d.value}</span>
            <span className="text-center text-[10px] leading-tight text-slate-400">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApprovalTimelineChart({ data }) {
  const max = Math.max(...data.map((d) => d.days))
  const min = Math.min(...data.map((d) => d.days))
  const w = 280
  const h = 100
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((d.days - min) / (max - min || 1)) * h
    return [x, y]
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  const latest = data[data.length - 1]
  const first = data[0]
  const change = Math.round(((first.days - latest.days) / first.days) * 100)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <Clock size={16} className="text-blue-600" />
        <h3 className="text-sm font-bold text-slate-900">Approval Timeline</h3>
        <span className="ml-auto text-xs text-slate-400">Last 6 months</span>
      </div>
      <p className="text-xs text-slate-400">Average time from submission to approval</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">
        {latest.days} <span className="text-sm font-medium text-slate-400">days</span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-24 w-full overflow-visible">
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 4 : 2.5} fill="#2563eb" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        {data.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
      {change > 0 && (
        <p className="mt-2 text-xs font-semibold text-green-600">↓ {change}% faster than last quarter</p>
      )}
    </div>
  )
}

export function PremisesWidget() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Your Premises</h3>
        </div>
        <Link to="/dashboard/premises" className="text-xs font-semibold text-blue-600 hover:underline">View All</Link>
      </div>
      <ul className="space-y-3">
        {premises.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
              <p className="truncate text-xs text-slate-400">{p.address}</p>
            </div>
            <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">{p.status}</span>
          </li>
        ))}
      </ul>
      <Link to="/dashboard/premises" className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-slate-50 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
        <Plus size={13} /> Add New Premises
      </Link>
    </div>
  )
}

const ACTIVITY_DOT = { green: 'bg-green-500', blue: 'bg-blue-500', orange: 'bg-orange-500' }

export function RecentActivityWidget() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
        <span className="text-xs font-semibold text-blue-600">View All</span>
      </div>
      <ul className="space-y-3">
        {recentActivity.map((a) => (
          <li key={a.id} className="flex items-start gap-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_DOT[a.tone]}`} />
            <div>
              <p className="text-xs text-slate-700">{a.text}</p>
              <p className="text-[10px] text-slate-400">{a.time}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
        <Link to="/dashboard/support" className="text-[11px] font-semibold text-slate-500 hover:text-blue-600">FAQs</Link>
        <Link to="/dashboard/support" className="text-[11px] font-semibold text-slate-500 hover:text-blue-600">Talk to Expert</Link>
        <Link to="/dashboard/support" className="text-[11px] font-semibold text-slate-500 hover:text-blue-600">Raise a Ticket</Link>
      </div>
    </div>
  )
}
