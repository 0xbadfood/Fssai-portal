import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { TRUST_DISCLAIMER } from '../lib/brand.js'

export default function Disclaimer({ compact = false }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${
        compact ? 'p-2.5 text-xs' : 'p-4 text-sm'
      }`}
    >
      <ShieldAlert size={compact ? 14 : 18} className="mt-0.5 shrink-0 text-amber-600" />
      <p className="leading-relaxed">{TRUST_DISCLAIMER}</p>
    </div>
  )
}
