import React, { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, CreditCard, FolderOpen, Home, Layers, LifeBuoy, LogOut, MapPin, Menu, UserCheck, X } from 'lucide-react'
import Logo from '../Logo.jsx'
import { useAuth } from '../../lib/auth.jsx'
import { useMeta } from '../../seo/useMeta.js'
import { privateMeta } from '../../seo/meta.js'
import { useApplications } from '../../lib/applications.js'
import { useSelectedApplicationId } from '../../lib/selectedApplication.js'

const NAV = [
  { to: '/dashboard/overview', label: 'Dashboard', icon: Home },
  // The tables of businesses and premises; an application opened from them (/dashboard/apply) belongs here too.
  { to: '/dashboard/applications', label: 'My applications', icon: Layers, also: ['/dashboard/apply'] },
  { to: '/dashboard/premises', label: 'Premises', icon: MapPin },
  { to: '/dashboard/documents', label: 'Document Vault', icon: FolderOpen },
  { to: '/dashboard/services', label: 'Expert services', icon: UserCheck },
  { to: '/dashboard/payments', label: 'Payments', icon: CreditCard },
  { to: '/dashboard/support', label: 'Support', icon: LifeBuoy },
]

export default function DashboardLayout() {
  useMeta(privateMeta('Dashboard', null))
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-gradient-to-b from-violet-50/70 via-slate-50 to-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col justify-between border-r border-violet-100/70 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="flex items-center justify-between px-5 py-5">
            <Logo withTagline={false} />
            <button className="rounded-lg p-1 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>
          <nav className="mt-2 space-y-1 px-3">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-bold transition ${
                    isActive || item.also?.includes(location.pathname)
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-200'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="p-4">
          <Link
            to="/services"
            className="group block overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 p-5 text-white shadow-lg shadow-violet-200"
          >
            <UserCheck size={22} />
            <p className="mt-3 text-base font-extrabold leading-snug">Stuck with FSSAI?</p>
            <p className="mt-1 text-sm text-white/85">Labels, notices, rejections: our experts can help.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold group-hover:gap-2">
              Talk to an expert <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 pb-10 pt-4 sm:px-6 lg:px-10 lg:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Pages that work on one application: with several, say which one and let the customer switch.
const PER_APPLICATION = ['/dashboard/apply', '/dashboard/overview', '/dashboard/documents']

/** Which business and premises the page is about, with a way back to the tables to pick another. */
function WorkingOn() {
  const location = useLocation()
  const { list, reload } = useApplications()
  const selected = useSelectedApplicationId()
  useEffect(() => {
    reload()
  }, [location.pathname, selected, reload])
  if (!list || list.length < 2 || !PER_APPLICATION.includes(location.pathname)) return null
  // No selection yet: the pages show the latest opened one (pending ones last), as the server does.
  const current = list.find((a) => a.id === selected) || [...list].sort((a, b) => (a.status === 'pending') - (b.status === 'pending'))[0]
  const where = [current.premises.address, current.premises.city].filter(Boolean).join(', ')
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
      <span className="min-w-0 truncate">
        <span className="font-bold capitalize text-slate-800">{current.business || 'New business'}</span>
        <span className="hidden text-slate-500 sm:inline"> · {where || 'premises not entered yet'}</span>
      </span>
      <Link to="/dashboard/applications" className="shrink-0 font-semibold text-violet-700 hover:underline">
        Change
      </Link>
    </div>
  )
}

function Topbar({ onMenu }) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const initials = (session?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-white/70 px-4 py-3 backdrop-blur-lg sm:px-6 lg:bg-transparent lg:px-10 lg:backdrop-blur-none">
      <button className="rounded-xl border border-slate-200 bg-white p-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu size={18} />
      </button>
      <div className="lg:hidden">
        <Logo withTagline={false} />
      </div>
      <WorkingOn />
      <div className="relative ml-auto">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-2xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-100 hover:ring-violet-200"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
            {initials}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-bold text-slate-800">{session?.name}</span>
            {session?.businessName && <span className="block text-xs text-slate-400">{session.businessName}</span>}
          </span>
          <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{session?.email}</p>
            </div>
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
