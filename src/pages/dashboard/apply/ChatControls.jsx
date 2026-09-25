import React, { useState } from 'react'
import { RotateCcw, Undo2 } from 'lucide-react'

export default function ChatControls({ app, flow }) {
  const [confirming, setConfirming] = useState(false)
  if (!app.transcript.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        disabled={flow.busy}
        onClick={flow.undo}
        className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-700 transition hover:border-violet-300 active:scale-95 disabled:opacity-50"
      >
        <Undo2 size={18} /> Undo last answer
      </button>
      {confirming ? (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-red-50 px-3 py-2">
          <span className="text-base font-semibold text-red-800">Clear all answers?</span>
          <button
            disabled={flow.busy}
            onClick={async () => {
              await flow.restart()
              setConfirming(false)
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-base font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Yes, start over
          </button>
          <button onClick={() => setConfirming(false)} className="rounded-xl px-3 py-2 text-base font-semibold text-slate-600 hover:bg-white">
            No
          </button>
        </span>
      ) : (
        <button
          disabled={flow.busy}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-700 transition hover:border-red-300 hover:text-red-700 active:scale-95 disabled:opacity-50"
        >
          <RotateCcw size={18} /> Start over
        </button>
      )}
    </div>
  )
}
