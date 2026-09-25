import React from 'react'
import { AlertTriangle, CheckCircle2, Bell } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { notices } from '../../lib/mockData.js'
import { STATUS } from '../../lib/eligibility.js'

const ICON = {
  [STATUS.CLARIFICATION_REQUESTED]: AlertTriangle,
  [STATUS.APPROVED]: CheckCircle2,
  [STATUS.REJECTED]: AlertTriangle,
}
const TONE = {
  [STATUS.CLARIFICATION_REQUESTED]: 'bg-orange-50 text-orange-600',
  [STATUS.APPROVED]: 'bg-green-50 text-green-600',
  [STATUS.REJECTED]: 'bg-red-50 text-red-600',
}

export default function NoticesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notices</h1>
          <p className="mt-1 text-sm text-slate-500">Official communication from the licensing authority — separate from general app notifications.</p>
        </div>
      </div>

      <div className="space-y-3">
        {notices.map((n) => {
          const Icon = ICON[n.status] || Bell
          return (
            <div key={n.id} className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONE[n.status]}`}>
                <Icon size={18} />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800">{n.title}</p>
                  <StatusBadge status={n.status} />
                </div>
                <p className="mt-1.5 text-sm text-slate-600">{n.body}</p>
                <p className="mt-2 text-xs text-slate-400">{n.date}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
