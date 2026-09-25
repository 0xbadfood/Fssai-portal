import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { AuthShell, Field } from './LoginPage.jsx'

// The token arrives in the URL fragment (#token=…), which browsers never send to servers or in referrers.
const tokenFromHash = () => new URLSearchParams(window.location.hash.slice(1)).get('token') || ''

export default function ResetPasswordPage() {
  const [token] = useState(tokenFromHash)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [state, setState] = useState({ busy: false, error: '' })

  // Drop the token from the address bar and history once read.
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) return setState({ busy: false, error: "The two passwords don't match." })
    setState({ busy: true, error: '' })
    const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: form.password }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setState({ busy: false, error: data.error || 'Something went wrong. Try again.' })
    window.location.assign('/dashboard') // full load so the app picks up the new session
  }

  if (!token) {
    return (
      <AuthShell>
        <h1 className="text-xl font-bold text-slate-900">This link is incomplete</h1>
        <p className="mt-2 text-sm text-slate-600">Open the link from your email again, or ask for a new one.</p>
        <Link to="/forgot-password" className="mt-5 inline-block text-sm font-semibold text-violet-600 hover:underline">
          Ask for a new link
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="mb-2 flex items-center gap-2 text-violet-700">
        <KeyRound size={18} />
        <h1 className="text-xl font-bold text-slate-900">Choose a new password</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">At least 8 characters. You'll be signed out on every other device.</p>
      {state.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}{' '}
          {/expired|not valid/.test(state.error) && (
            <Link to="/forgot-password" className="font-semibold underline">
              New link
            </Link>
          )}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
        <Field label="Type it again" type="password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} placeholder="••••••••" />
        <button type="submit" disabled={state.busy} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {state.busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  )
}
