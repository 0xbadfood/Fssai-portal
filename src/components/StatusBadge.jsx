import React from 'react'
import { STATUS_META } from '../lib/eligibility.js'

const COLOR_CLASSES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
}

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${COLOR_CLASSES[meta.color]} ${className}`}
    >
      {meta.label}
    </span>
  )
}
