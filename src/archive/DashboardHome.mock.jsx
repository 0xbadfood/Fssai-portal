import React from 'react'
import { useAuth } from '../../lib/auth.jsx'
import { kpis, applicationFunnel, approvalTimeline } from '../../lib/mockData.js'
import {
  KpiCards,
  LiveApplicationTracker,
  DocumentVaultPreview,
  ApplicationFunnelChart,
  ApprovalTimelineChart,
  PremisesWidget,
  RecentActivityWidget,
} from '../../components/dashboard/widgets.jsx'
import AIAssistant from '../../components/dashboard/AIAssistant.jsx'
import { Link } from 'react-router-dom'
import { ArrowRight, Leaf, Sparkles } from 'lucide-react'

export default function DashboardHome() {
  const { session } = useAuth()
  const firstName = session?.name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {firstName}! 👋</h1>
          <p className="mt-1 text-sm text-slate-500">Let's keep your business compliant and growing.</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-green-50 to-blue-50 px-5 py-3">
          <Leaf className="shrink-0 text-green-600" size={22} />
          <div>
            <p className="text-sm font-bold text-slate-800">Good Food Builds Brighter Tomorrows</p>
            <p className="text-[11px] text-slate-500">In partnership with a safer food ecosystem for India</p>
          </div>
        </div>
      </div>

      <KpiCards kpis={kpis} />
      <Link
        to="/dashboard/apply"
        className="flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-400 p-5 text-white shadow"
      >
        <span className="flex items-center gap-3">
          <Sparkles size={22} />
          <span>
            <span className="block text-lg font-bold">My Application</span>
            <span className="block text-sm text-white/85">Find your licence and apply in a few taps</span>
          </span>
        </span>
        <ArrowRight />
      </Link>

      <LiveApplicationTracker />

      <div className="grid gap-4 lg:grid-cols-3">
        <DocumentVaultPreview />
        <AIAssistant compact />
        <RecentActivityWidget />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ApplicationFunnelChart data={applicationFunnel} />
        <ApprovalTimelineChart data={approvalTimeline} />
        <PremisesWidget />
      </div>
    </div>
  )
}
