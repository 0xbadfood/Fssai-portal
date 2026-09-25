import React from 'react'

/** Page title block used across the dashboard. */
export function PageHeader({ emoji, title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900">
          {emoji && <span className="text-3xl">{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-base text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Card({ className = '', children }) {
  return <div className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>
}

export function Loading() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/70" />
      ))}
    </div>
  )
}
