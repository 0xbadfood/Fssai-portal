import React from 'react'
import { useParams } from 'react-router-dom'
import { BackToQueue } from './OpsLayout.jsx'

// The full case page (summary, details, document review, requests, filing session) comes in the next step.
export default function OpsCasePage() {
  const { id } = useParams()
  return (
    <div className="space-y-4">
      <BackToQueue />
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-extrabold text-slate-900">Case {id.slice(0, 8)}</h1>
        <p className="mt-2 text-slate-500">The case page is being built next.</p>
      </div>
    </div>
  )
}
