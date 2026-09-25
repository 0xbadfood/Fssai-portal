import React, { useState } from 'react'
import { Sparkles, Send, Bot } from 'lucide-react'
import { aiQuickChips, aiScriptedReplies } from '../../lib/mockData.js'
import { useAuth } from '../../lib/auth.jsx'

const FALLBACK =
  "I'm a demo assistant for this mockup — in the full product I'd pull live answers from your application data. Try one of the quick questions below, or ask about eligibility, documents or fees."

export default function AIAssistant({ compact = false }) {
  const { session } = useAuth()
  const [messages, setMessages] = useState([
    { from: 'bot', text: `Hi ${session?.name?.split(' ')[0] || 'there'}! 👋 How can I help you with your FSSAI compliance today?` },
  ])
  const [input, setInput] = useState('')

  function send(text) {
    if (!text.trim()) return
    const reply = aiScriptedReplies[text] || FALLBACK
    setMessages((m) => [...m, { from: 'user', text }, { from: 'bot', text: reply }])
    setInput('')
  }

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-100 bg-white p-5 ${compact ? '' : 'h-full'}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900">AI Compliance Assistant</h3>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-medium text-green-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Always here to help
        </span>
      </div>

      <div className={`mb-3 space-y-2 overflow-y-auto ${compact ? 'max-h-52' : 'max-h-80 flex-1'}`}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg p-2.5 text-xs leading-relaxed ${
              m.from === 'bot' ? 'bg-purple-50 text-purple-900' : 'ml-6 bg-blue-50 text-blue-900'
            }`}
          >
            {m.from === 'bot' && <Bot size={14} className="mt-0.5 shrink-0" />}
            <span>{m.text}</span>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {aiQuickChips.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-purple-300 hover:text-purple-700"
          >
            {c}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about FSSAI compliance..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
        />
        <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700">
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
