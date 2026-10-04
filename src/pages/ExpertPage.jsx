import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, CalendarClock, FileSearch, FlaskConical, GraduationCap, Landmark, Loader2, MapPin, ShieldCheck, Tags, Wine } from 'lucide-react'
import LandingNavbar from '../components/landing/LandingNavbar.jsx'
import Footer from '../components/landing/Footer.jsx'
import { useCatalogue } from '../lib/catalogue.js'
import { useMeta } from '../seo/useMeta.js'
import { expertMeta } from '../seo/meta.js'

// One icon per expertise card, in the order of config/services.json → expert.expertise.
const EXPERTISE_ICONS = [BadgeCheck, Tags, FlaskConical, Wine, Landmark]

/** The expert's profile (/about): who leads the work, from config/services.json → expert. */
export default function ExpertPage() {
  const { cat, error } = useCatalogue()
  // A server still running an older catalogue sends the profile without these lists.
  const x = cat?.expert && { education: [], expertise: [], companies: [], highlights: [], ...cat.expert }
  useMeta(x?.name ? expertMeta(x) : null)

  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      {error && <p className="mx-auto mt-16 max-w-3xl rounded-2xl bg-red-50 p-4 text-red-700">The profile could not be loaded: {error}</p>}
      {!x && !error && <p className="mt-24 flex items-center justify-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={18} /> Loading…</p>}
      {x && (
        <>
          <Hero x={x} />
          <Expertise x={x} />
          <WorkWith />
        </>
      )}
      <Footer />
    </div>
  )
}

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

function LinkedInIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}

function Hero({ x }) {
  return (
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(60rem 30rem at 10% -10%, rgba(139,92,246,.45), transparent 60%), radial-gradient(50rem 30rem at 100% 120%, rgba(16,185,129,.30), transparent 60%)' }} />
      <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[auto,1fr] lg:items-center lg:gap-14 lg:px-8 lg:py-24">
        <div className="relative mx-auto lg:mx-0">
          <div className="absolute -inset-3 rounded-[40px] bg-gradient-to-br from-violet-500/40 to-emerald-400/30 blur-2xl" />
          {x.photo ? (
            <img src={x.photo} alt={x.name} width="288" height="288" className="relative h-56 w-56 rounded-[36px] object-cover ring-1 ring-white/20 sm:h-72 sm:w-72" />
          ) : (
            <div className="relative flex h-56 w-56 items-center justify-center rounded-[36px] bg-gradient-to-br from-violet-500 to-emerald-500 text-7xl font-black tracking-tight ring-1 ring-white/20 sm:h-72 sm:w-72" aria-hidden="true">
              {x.name ? initials(x.name) : <ShieldCheck size={72} />}
            </div>
          )}
        </div>

        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-violet-200 ring-1 ring-white/15">
            <ShieldCheck size={14} /> Our regulatory expert
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{x.name || 'Our regulatory lead'}</h1>
          <p className="mt-2 text-xl font-bold text-violet-200">{x.title}</p>
          {x.formerly && <p className="mt-1 text-sm text-slate-400">Formerly {x.formerly}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
            {x.location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {x.location}</span>}
            {x.education.map((e) => (
              <span key={e.institution} className="inline-flex items-center gap-1.5"><GraduationCap size={15} /> {[e.degree, e.institution].filter(Boolean).join(', ')}</span>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{x.summary}</p>

          <p className="mt-7 text-xs font-bold uppercase tracking-widest text-slate-400">Has worked with</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {x.companies.map((c) => x.logos?.[c] ? (
              <span key={c} className="flex h-20 items-center rounded-2xl bg-white px-6 shadow-lg shadow-black/20" title={c}>
                <img src={x.logos[c]} alt={`${c} logo`} className="h-14 w-auto max-w-[160px] object-contain" />
              </span>
            ) : (
              <span key={c} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-base font-extrabold tracking-tight ring-1 ring-white/15">
                <Building2 size={16} className="text-violet-200" /> {c}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/services/30-minute-consultation" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-slate-900 shadow-lg hover:bg-violet-50">
              <CalendarClock size={18} /> Book a 30-minute consultation
            </Link>
            {x.linkedin && (
              <a href={x.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3.5 font-bold text-white ring-1 ring-white/25 hover:bg-white/15">
                <LinkedInIcon /> LinkedIn profile
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10 bg-white/[.03]">
        <div className="mx-auto grid max-w-7xl grid-cols-3 gap-4 px-4 py-7 sm:px-6 lg:px-8">
          {x.highlights.map((h) => (
            <div key={h.label} className="text-center sm:text-left">
              <p className="text-3xl font-black">{h.value}</p>
              <p className="text-sm leading-snug text-slate-400">{h.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Expertise({ x }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <p className="text-sm font-bold uppercase tracking-widest text-violet-500">Expertise</p>
      <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900">What she brings to your food business</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {x.expertise.map((e, i) => {
          const Icon = EXPERTISE_ICONS[i] || FileSearch
          return (
            <div key={e.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200"><Icon size={20} /></span>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">{e.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500">{e.text}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WorkWith() {
  const ways = [
    { to: '/services/30-minute-consultation', title: 'A 30-minute call', text: 'Talk your situation through and leave with clear next steps.' },
    { to: '/services/specific-regulatory-query', title: 'One specific question', text: 'A written answer to one regulatory question about your product or business.' },
    { to: '/services', title: 'A fixed-fee service', text: 'Licences, label reviews, classification, imports, notices and more.' },
  ]
  return (
    <section className="border-t border-slate-100 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-extrabold text-slate-900">Work with her</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ways.map((w) => (
            <Link key={w.to} to={w.to} className="group rounded-2xl bg-white p-6 ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-violet-200">
              <p className="font-extrabold text-slate-900">{w.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{w.text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-violet-600 group-hover:gap-1.5">See details <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
        <p className="mt-10 text-xs text-slate-400">Companies are listed as past experience, not endorsements. We are an independent consultancy, not affiliated with FSSAI; approval by any authority cannot be guaranteed.</p>
      </div>
    </section>
  )
}
