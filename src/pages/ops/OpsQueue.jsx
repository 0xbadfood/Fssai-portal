import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Loader2, RefreshCw, Search, UserPlus } from 'lucide-react'

// Flags shown on a case, most urgent first (worked out on the server).
const FLAGS = {
  rated_wrong: { label: '👎 Result rated wrong', tone: 'bg-red-50 text-red-700 ring-red-100' },
  expert: { label: '🧑‍⚖️ Expert to place', tone: 'bg-violet-50 text-violet-700 ring-violet-100' },
  docs_missing: { label: 'Docs missing', tone: 'bg-amber-50 text-amber-800 ring-amber-100' },
  doc_review: { label: 'Doc to review', tone: 'bg-amber-50 text-amber-800 ring-amber-100' },
  pdf_locked: { label: '🔒 PDF password', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  provisional: { label: 'Provisional result', tone: 'bg-slate-50 text-slate-500 ring-slate-200' },
  test_payment: { label: 'Test payment', tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  mismatch: { label: 'Details don’t match', tone: 'bg-red-50 text-red-700 ring-red-100' },
}
const CLOSED = ['granted', 'rejected']
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`

function ago(t) {
  const s = (Date.now() - new Date(t).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

async function api(path, body) {
  const res = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export default function OpsQueue() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null) // case id being changed
  const [status, setStatus] = useState('open')
  const [who, setWho] = useState('all') // all | mine | unassigned
  const [q, setQ] = useState('')

  const load = () =>
    api('/api/ops/cases')
      .then(setData)
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  async function act(id, path, body = {}) {
    setBusy(id)
    setError('')
    try {
      setData(await api(`/api/ops/cases/${id}/${path}`, body))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(() => {
    const c = { open: 0, all: 0 }
    for (const x of data?.cases || []) {
      c[x.status] = (c[x.status] || 0) + 1
      c.all++
      if (!CLOSED.includes(x.status)) c.open++
    }
    return c
  }, [data])

  if (!data) {
    return <div className="flex justify-center py-20 text-slate-400">{error ? <p className="text-red-600">{error}</p> : <Loader2 className="animate-spin" />}</div>
  }

  const me = data.me.id
  const needle = q.trim().toLowerCase()
  const rows = data.cases.filter(
    (c) =>
      (status === 'all' || (status === 'open' ? !CLOSED.includes(c.status) : c.status === status)) &&
      (who === 'all' || (who === 'mine' ? c.assignee?.id === me : !c.assignee)) &&
      (!needle || [c.ref, c.business, c.owner, c.phone, c.email, c.arn].some((v) => String(v || '').toLowerCase().includes(needle))),
  )
  const label = Object.fromEntries(data.statuses.map((s) => [s.id, s.label]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Queue</h1>
          <p className="text-sm text-slate-500">A case appears here when the customer's payment goes through.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-violet-400">
            <Search size={15} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ref, name, phone, email, ARN" className="w-56 text-sm focus:outline-none" />
          </label>
          <button onClick={load} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-violet-600" aria-label="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ id: 'open', label: 'Open' }, ...data.statuses, { id: 'all', label: 'All' }].map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${status === s.id ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-violet-300'}`}
          >
            {s.label} <span className={status === s.id ? 'text-white/80' : 'text-slate-400'}>{counts[s.id] || 0}</span>
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        {[['all', 'Everyone'], ['mine', 'Mine'], ['unassigned', 'Unassigned']].map(([id, text]) => (
          <button key={id} onClick={() => setWho(id)} className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${who === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {text}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3">Business / applicant</th>
              <th className="px-4 py-3">Licence</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Docs</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id} onClick={() => navigate(`/ops/cases/${c.id}`)} className="cursor-pointer align-top hover:bg-violet-50/40">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{c.ref}</td>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{c.business}</p>
                  <p className="text-xs text-slate-500">
                    {c.owner} · {c.phone}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{c.licence || '—'}</p>
                  {c.fee != null && <p className="text-xs text-slate-500">{rupees(c.fee)}/yr</p>}
                </td>
                <td className="px-4 py-3 text-slate-700">{c.states.join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${c.docs.done < c.docs.required ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {c.docs.done}/{c.docs.required}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[230px] flex-wrap gap-1">
                    {c.flags.map((f) => (
                      <span key={f} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${FLAGS[f]?.tone || 'bg-slate-50 ring-slate-200'}`}>
                        {FLAGS[f]?.label || f}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{label[c.status] || c.status}</td>
                <td className="px-4 py-3 text-slate-500" title={new Date(c.openedAt).toLocaleString('en-IN')}>
                  {ago(c.openedAt)}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <Owner c={c} me={me} members={data.members} busy={busy === c.id} onTake={() => act(c.id, 'take')} onTransfer={(to, note) => act(c.id, 'transfer', { to, note })} />
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                  {data.cases.length ? 'No cases match these filters.' : 'No cases yet. Paid applications will appear here.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Who has the case: "Take it" when unassigned, and a transfer to any other team member. */
function Owner({ c, me, members, busy, onTake, onTransfer }) {
  const [moving, setMoving] = useState(false)
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const others = members.filter((m) => m.id !== c.assignee?.id)

  if (moving) {
    return (
      <div className="w-56 space-y-1.5">
        <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
          <option value="">Transfer to…</option>
          {others.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === me ? ' (me)' : ''}
            </option>
          ))}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
        <div className="flex gap-1.5">
          <button
            disabled={!to || busy}
            onClick={() => {
              onTransfer(to, note)
              setMoving(false)
            }}
            className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
          >
            Move
          </button>
          <button onClick={() => setMoving(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {c.assignee ? (
        <span className="font-semibold text-slate-800">{c.assignee.id === me ? 'Me' : c.assignee.name}</span>
      ) : (
        <button disabled={busy} onClick={onTake} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">
          <UserPlus size={13} /> Take it
        </button>
      )}
      {others.length > 0 && (
        <button onClick={() => setMoving(true)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-600" title="Transfer to someone else" aria-label="Transfer">
          <ArrowRightLeft size={15} />
        </button>
      )}
    </div>
  )
}
