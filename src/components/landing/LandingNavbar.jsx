import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '../Logo.jsx'
import { isOpsRole, useAuth } from '../../lib/auth.jsx'

export const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#how', label: 'How it works' },
  { href: '/services', label: 'Expert services' },
  { href: '/about', label: 'Our expert' },
  { href: '/blog', label: 'Guides' },
  { href: '/#faq', label: 'FAQ' },
]

/** Signed in: a way back to the dashboard (or the ops console) instead of Sign in / Start free. */
function AccountLinks({ mobile = false }) {
  const { session } = useAuth()
  if (session) {
    const ops = isOpsRole(session.role)
    return (
      <Link
        to={ops ? '/ops' : '/dashboard'}
        className={`${mobile ? 'flex-1 py-2 text-center' : 'px-4 py-2'} rounded-xl bg-violet-600 text-sm font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700`}
      >
        {ops ? 'Ops console' : 'My dashboard'}
      </Link>
    )
  }
  return (
    <>
      <Link to="/login" className={mobile ? 'flex-1 rounded-xl border border-slate-200 py-2 text-center text-sm font-bold text-slate-700' : 'rounded-xl px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50'}>
        Sign in
      </Link>
      <Link
        to="/signup"
        className={mobile ? 'flex-1 rounded-xl bg-violet-600 py-2 text-center text-sm font-bold text-white' : 'rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-200 hover:bg-violet-700'}
      >
        Start free
      </Link>
    </>
  )
}

export default function LandingNavbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-semibold text-slate-600 transition hover:text-violet-600">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <AccountLinks />
        </div>
        <button className="rounded-lg border border-slate-200 p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <AccountLinks mobile />
          </div>
        </div>
      )}
    </header>
  )
}
