import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera, CheckCircle2, FileCheck2, Minus, MousePointerClick, Plus, Send, Sparkles, UserCheck } from 'lucide-react'
import LandingChat from './LandingChat.jsx'
import RotatingHeadline from './RotatingHeadline.jsx'
import { SERVICES } from '../../lib/services.js'
import { BRAND_DOMAIN } from '../../lib/brand.js'

export function Hero() {
  return (
    <section id="home" className="relative overflow-clip">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-50 via-fuchsia-50/40 to-white" />
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr,1fr] lg:px-8 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-violet-700 shadow-sm ring-1 ring-violet-100">
            <Sparkles size={14} /> AI-powered FSSAI compliance
          </span>
          <RotatingHeadline />
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Snap two photos, tap a few answers, and our AI fills in your forms. Our FSSAI experts check everything
            before it's filed, and stay with you for anything that comes after.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-violet-300/50 transition hover:bg-violet-700"
            >
              Start free <ArrowRight size={18} />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-7 py-4 text-base font-bold text-slate-700 transition hover:border-violet-300"
            >
              <UserCheck size={18} /> Talk to an expert
            </a>
          </div>
          <ul className="mt-8 grid gap-2.5 text-sm font-medium text-slate-600 sm:grid-cols-2">
            {['Registration, State & Central licences', 'Label & artwork review', 'Help with notices & rejections', 'Compliance & food safety'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <p className="mb-3 text-center text-sm font-semibold text-slate-500 lg:text-left">
            👇 Try it now: find your licence in about a minute
          </p>
          <LandingChat />
        </div>
      </div>
    </section>
  )
}

const PILLARS = [
  {
    icon: Sparkles,
    grad: 'from-violet-500 to-fuchsia-500',
    tint: 'bg-violet-50',
    kicker: 'AI-enabled',
    title: 'AI does the paperwork',
    points: ['Reads your ID and electricity bill from a photo', 'Fills in Form A or B for you', 'Checks every document before it is submitted'],
  },
  {
    icon: MousePointerClick,
    grad: 'from-orange-400 to-pink-500',
    tint: 'bg-orange-50',
    kicker: 'Simpler than you think',
    title: 'A few taps, no jargon',
    points: ['Plain questions about your business', 'Tap an answer or just type it in your own words', 'Works on your phone, start to finish'],
  },
  {
    icon: UserCheck,
    grad: 'from-emerald-500 to-teal-500',
    tint: 'bg-emerald-50',
    kicker: 'Real experts',
    title: 'FSSAI specialists behind every step',
    points: ['Licensing, compliance and food safety', 'Notices, rejections and officer queries handled', 'A person to call when something is unclear'],
  },
]

export function Pillars() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <Heading kicker="Why us" title="Smart technology. Simple steps. Real experts." />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className={`relative overflow-hidden rounded-3xl ${p.tint} p-7`}>
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${p.grad} text-white shadow-lg`}>
              <p.icon size={26} />
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-slate-500">{p.kicker}</p>
            <h3 className="mt-1 text-2xl font-extrabold text-slate-900">{p.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {p.points.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

const STEPS = [
  { icon: Camera, title: 'Snap two photos', desc: 'Your ID and an electricity bill. We read the details for you.' },
  { icon: MousePointerClick, title: 'Tap a few answers', desc: 'About a minute to know exactly which licence you need.' },
  { icon: FileCheck2, title: 'AI fills, experts check', desc: 'Forms and documents prepared and reviewed before filing.' },
  { icon: Send, title: 'We file it with you', desc: 'A quick call for the OTP and government fee on the official FoSCoS portal.' },
]

export function HowItWorks() {
  return (
    <section id="how" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading kicker="How it works" title="From photo to filing in four steps" />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <span className="absolute right-5 top-4 text-5xl font-black text-slate-100">{i + 1}</span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <s.icon size={22} />
              </span>
              <h3 className="relative mt-5 text-lg font-extrabold text-slate-900">{s.title}</h3>
              <p className="relative mt-1.5 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const SERVICE_TONE = {
  violet: 'from-violet-500 to-fuchsia-500',
  orange: 'from-orange-400 to-pink-500',
  emerald: 'from-emerald-500 to-teal-500',
  sky: 'from-sky-500 to-indigo-500',
}

export function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <Heading
        kicker="Our services"
        title="Beyond the licence: FSSAI experts for whatever comes up"
        subtitle="Licensing, labels, compliance or a problem with the regulator: one team that knows FSSAI inside out."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {SERVICES.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.title} className="group flex flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/70">
              <div className="flex items-start gap-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${SERVICE_TONE[s.tone] || SERVICE_TONE.violet} text-white shadow-md`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.desc}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 sm:pl-16">
                {s.points.map((p) => (
                  <span key={p} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100">
                    {p}
                  </span>
                ))}
              </div>
              <Link to={s.cta.to} className="mt-5 inline-flex items-center gap-1 self-start text-sm font-bold text-violet-600 group-hover:gap-2 sm:ml-16">
                {s.cta.label} <ArrowRight size={15} />
              </Link>
            </div>
          )
        })}
      </div>
      <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-7 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-lg font-extrabold text-slate-900">Something else on your mind?</p>
          <p className="mt-1 text-sm text-slate-600">
            Product approvals, imports, a question you can't find answered anywhere. If it's about FSSAI, ask us.
          </p>
        </div>
        <Link to="/signup" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-violet-700 shadow-sm ring-1 ring-violet-200 hover:bg-violet-50">
          Ask an expert <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: `Is ${BRAND_DOMAIN} the official FSSAI website?`,
    a: 'No. We are a private compliance-assistance service, not affiliated with FSSAI. We prepare your application and help you file it on the Government’s official FoSCoS portal (fscos.fssai.gov.in).',
  },
  {
    q: 'Which licence do I need?',
    a: 'It depends on what you do, where you do it and your yearly sales. Use the assistant at the top of this page: a few taps and it tells you whether you need Basic Registration, a State Licence or a Central Licence.',
  },
  {
    q: 'Do I have to use the government portal myself?',
    a: 'No. We prepare the forms and documents. For the filing we give you a short call, because the portal sends you an OTP and the government fee is paid in your name.',
  },
  {
    q: 'My application was rejected, or I received a notice. Can you help?',
    a: 'Yes. Our experts handle rejections, officer queries, improvement notices and suspended licences. Create a free account and tell us what happened.',
  },
  {
    q: 'Can you check my product label?',
    a: 'Yes. We review label artwork against the FSS (Labelling and Display) Regulations before you print, so you avoid reprints and objections.',
  },
  {
    q: 'Who can see my documents?',
    a: 'Only you, and our team while preparing your application. Your documents are used only for your FSSAI filing.',
  },
]

export function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Heading kicker="FAQ" title="Questions, answered" />
        <div className="mt-10 space-y-3">
          {FAQS.map((f, i) => {
            const on = open === i
            return (
              <div key={f.q} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <button onClick={() => setOpen(on ? -1 : i)} className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="font-bold text-slate-800">{f.q}</span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${on ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {on ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                {on && <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-orange-400 px-6 py-14 text-center text-white shadow-2xl shadow-violet-300/50 sm:px-12">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-white/10" />
        <h2 className="relative text-3xl font-extrabold sm:text-4xl">Let's get your food business licensed.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/90">
          Start in a minute on your phone. Our AI does the heavy lifting, our experts make sure it's right.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 font-bold text-violet-700 shadow-lg hover:bg-violet-50">
            Start free <ArrowRight size={18} />
          </Link>
          <a href="#home" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-7 py-4 font-bold text-white ring-1 ring-white/40 hover:bg-white/25">
            <Sparkles size={18} /> Ask the assistant
          </a>
        </div>
      </div>
    </section>
  )
}

function Heading({ kicker, title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-violet-600">{kicker}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-lg text-slate-600">{subtitle}</p>}
    </div>
  )
}
