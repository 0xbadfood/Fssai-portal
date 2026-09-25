import React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useCurrentApplication } from '../../lib/applications.js'

/** Where /dashboard lands after sign-in: the dashboard once the application is complete, otherwise the application. */
export default function DashboardIndex() {
  const { app } = useCurrentApplication()
  if (app === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-violet-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }
  return <Navigate to={app?.status === 'ready' ? '/dashboard/overview' : '/dashboard/apply'} replace />
}
