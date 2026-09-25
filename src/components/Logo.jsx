import React from 'react'
import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BRAND_NAME, BRAND_TAGLINE } from '../lib/brand.js'

export default function Logo({ withTagline = true, to = '/', dark = false }) {
  const content = (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm">
        <Leaf size={18} />
      </span>
      <div className="leading-tight">
        <div className="flex items-baseline gap-1">
          <span className={`text-lg font-extrabold ${dark ? 'text-white' : 'text-slate-900'}`}>
            {BRAND_NAME}
          </span>
          <span className="rounded bg-violet-50 px-1 py-0.5 text-[10px] font-bold text-violet-600 ring-1 ring-violet-100">
            .co.in
          </span>
        </div>
        {withTagline && (
          <div className={`text-[11px] font-medium ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
            {BRAND_TAGLINE}
          </div>
        )}
      </div>
    </div>
  )
  if (!to) return content
  return (
    <Link to={to} className="shrink-0">
      {content}
    </Link>
  )
}
