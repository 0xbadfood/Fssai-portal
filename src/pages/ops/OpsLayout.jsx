import React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import { useAuth } from '../../lib/auth.jsx'

/** Operations console shell: a plain top bar, wide content (the team works on laptops). */
export default function OpsLayout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Logo withTagline={false} to="/ops" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
            <ShieldCheck size={13} /> Operations
          </span>
          <nav className="flex gap-1">
            <NavLink end to="/ops" className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-bold ${isActive ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-100'}`}>
              Queue
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-right text-sm leading-tight">
              <span className="block font-bold text-slate-800">{session?.name}</span>
              <span className="block text-xs text-slate-400">{session?.role === 'admin' ? 'Admin' : 'Operations team'}</span>
            </span>
            <button
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-red-200 hover:text-red-600"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export function BackToQueue() {
  return (
    <Link to="/ops" className="text-sm font-semibold text-violet-600 hover:underline">
      ← Back to the queue
    </Link>
  )
}
