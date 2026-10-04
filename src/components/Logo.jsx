import React, { useId } from 'react'
import { Link } from 'react-router-dom'
import { BRAND_NAME, BRAND_TAGLINE, BRAND_TLD } from '../lib/brand.js'

// The brand mark: a leaf with a check over an orange plate. Same drawing as scripts/seo/brand/mark.svg
// (favicon, app icons, share image); change both together and rerun scripts/seo/brand/build.sh.
export function LogoMark({ className = 'h-9 w-9' }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M15 44 C13 25 28 11 51 11 C52 33 37 47 15 44 Z" fill="#fff" />
      <path d="M24 29.5 L30 35.5 L40.5 23.5" fill="none" stroke="#059669" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 49 C24 56 42 54 54 42" fill="none" stroke="#fb923c" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ withTagline = true, to = '/', dark = false }) {
  const content = (
    <div className="flex items-center gap-2">
      <LogoMark className="h-9 w-9 shrink-0 drop-shadow-sm" />
      <div className="leading-tight">
        <div className="flex items-baseline">
          <span className={`text-lg font-extrabold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
            {BRAND_NAME.split(/(Food)/).map((part, i) =>
              part === 'Food' ? <span key={i} className={dark ? 'text-green-400' : 'text-green-600'}>{part}</span> : part,
            )}
          </span>
          <span className={`text-xs font-bold ${dark ? 'text-orange-400' : 'text-orange-600'}`}>{BRAND_TLD}</span>
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
