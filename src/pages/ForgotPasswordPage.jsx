import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, MailCheck } from 'lucide-react'
import { AuthShell, Field } from './LoginPage.jsx'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ busy: false, sent: false, error: '' })

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, sent: false, error: '' })
    const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await res.json().catch(() => ({}))
    setState(res.ok ? { busy: false, sent: true, error: '' } : { busy: false, sent: false, error: data.error || 'Something went wrong. Try again.' })
  }

  return (
    <AuthShell>
      {state.sent ? (
        <div className="text-center">
          <MailCheck size={40} className="mx-auto text-violet-600" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Check your email</h1>
          <p className="mt-2 text-sm text-slate-600">
            If <b>{email}</b> has an account, we've sent a link to choose a new password. It expires in 30 minutes.
          </p>
          <Link to="/login" className="mt-5 inline-block text-sm font-semibold text-violet-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 text-violet-700">
            <KeyRound size={18} />
            <h1 className="text-xl font-bold text-slate-900">Forgot your password?</h1>
          </div>
          <p className="mb-5 text-sm text-slate-500">Enter the email you signed up with and we'll send you a link to choose a new one.</p>
          {state.error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@business.com" />
            <button type="submit" disabled={state.busy} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {state.busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-violet-600 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
