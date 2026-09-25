import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Minus, Plus, Send } from 'lucide-react'
import { useAuth } from '../../lib/auth.jsx'
import { CONTACT_VIA, SUPPORT_TOPICS } from '../../lib/supportTopics.js'
import { Card, PageHeader } from '../../components/dashboard/ui.jsx'

const FAQS = [
  { q: 'How do I find out which licence I need?', a: 'Open My Application and tap a few answers about your business. It takes about a minute and tells you whether you need Basic Registration, a State Licence or a Central Licence.' },
  { q: 'Who files my application on the government portal?', a: 'We do, with you. Once your application is ready, our team calls you: FoSCoS sends you an OTP, and the government fee is paid in your name.' },
  { q: 'How long does approval take?', a: 'Once filed with complete documents, most applications are decided in about 15–30 days. It varies by state and licence type.' },
  { q: 'Do I need to renew my licence?', a: 'No. Under the 2026 framework, registrations and licences stay valid unless they are suspended, cancelled or surrendered. You only apply for a modification if your business details change.' },
  { q: 'I have more than one place of business.', a: 'Each place needs its own registration or licence (transporters are licensed once). Send us a request under "Another place of business" and we will set them up.' },
]

const STATUS = { open: ['Received', 'bg-amber-50 text-amber-700'], in_progress: ['In progress', 'bg-sky-50 text-sky-700'], closed: ['Resolved', 'bg-emerald-50 text-emerald-700'] }

export default function SupportPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [topic, setTopic] = useState(SUPPORT_TOPICS.some((t) => t.id === params.get('topic')) ? params.get('topic') : '')
  const [message, setMessage] = useState('')
  const [contactVia, setContactVia] = useState('call')
  const [requests, setRequests] = useState([])
  const [state, setState] = useState({ busy: false, error: '', sent: false })
  const [open, setOpen] = useState(-1)

  useEffect(() => {
    fetch('/api/support', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRequests(d.requests || []))
      .catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, error: '', sent: false })
    try {
      const res = await fetch('/api/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic, message, contactVia }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send your request')
      setRequests((r) => [data.request, ...r])
      setMessage('')
      setState({ busy: false, error: '', sent: true })
    } catch (err) {
      setState({ busy: false, error: err.message, sent: false })
    }
  }

  const topicLabel = (id) => SUPPORT_TOPICS.find((t) => t.id === id)?.label || id

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader emoji="🛟" title="Talk to an expert" subtitle="Licences, labels, notices or anything else about FSSAI. Tell us what you need and an expert will get back to you." />

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <Card>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <p className="text-base font-extrabold text-slate-900">What is it about?</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUPPORT_TOPICS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopic(t.id)}
                    className={`flex items-center gap-2.5 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition ${
                      topic === t.id ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-100 bg-white text-slate-700 hover:border-violet-200'
                    }`}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span>
                      {t.label}
                      {t.example && <span className="block text-xs font-medium text-slate-500">{t.example}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="support-message" className="text-base font-extrabold text-slate-900">Tell us a little more</label>
              <textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="e.g. We got an improvement notice after an inspection last week."
                className="mt-2 w-full rounded-2xl border-2 border-slate-100 px-4 py-3 text-base focus:border-violet-400 focus:outline-none"
              />
            </div>
            <div>
              <p className="text-base font-extrabold text-slate-900">How should we reach you?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTACT_VIA.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setContactVia(c.id)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${contactVia === c.id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                We'll use {contactVia === 'email' ? session?.email : session?.phone || 'the number on your account'}.
              </p>
            </div>
            {state.error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</p>}
            {state.sent && (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} /> Sent. An expert will get back to you.
              </p>
            )}
            <button
              type="submit"
              disabled={state.busy || !topic || message.trim().length < 5}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-40 disabled:shadow-none"
            >
              <Send size={18} /> Send to an expert
            </button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-extrabold text-slate-900">Your requests</h2>
            {requests.length ? (
              <ul className="mt-3 space-y-3">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-800">{topicLabel(r.topic)}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[r.status]?.[1]}`}>{STATUS[r.status]?.[0]}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{r.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Nothing yet. Requests you send show up here.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold text-slate-900">Quick answers</h2>
            <div className="mt-3 space-y-2">
              {FAQS.map((f, i) => (
                <div key={f.q} className={`rounded-2xl p-3.5 ${open === i ? 'bg-violet-50' : 'bg-slate-50'}`}>
                  <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-3 text-left text-sm font-bold text-slate-800">
                    {f.q}
                    {open === i ? <Minus size={14} className="shrink-0" /> : <Plus size={14} className="shrink-0" />}
                  </button>
                  {open === i && <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
