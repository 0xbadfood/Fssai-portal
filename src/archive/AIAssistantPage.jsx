import React from 'react'
import AIAssistant from '../../components/dashboard/AIAssistant.jsx'

export default function AIAssistantPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Compliance Assistant</h1>
        <p className="mt-1 text-sm text-slate-500">Ask questions about eligibility, documents, fees or your application status.</p>
      </div>
      <div className="mx-auto max-w-2xl">
        <AIAssistant />
      </div>
    </div>
  )
}
