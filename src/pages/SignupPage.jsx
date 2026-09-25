import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { AuthShell, Field } from './LoginPage.jsx'

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ businessName: '', name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(key) {
    return (v) => setForm((f) => ({ ...f, [key]: v }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await signup(form)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell>
      <div className="mb-6 flex items-center gap-2 text-violet-700">
        <UserPlus size={18} />
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Business name" value={form.businessName} onChange={set('businessName')} placeholder="Acme Foods Pvt. Ltd." />
        <Field label="Your name" value={form.name} onChange={set('name')} placeholder="Rahul Kumar" />
        <Field label="Email address" type="email" value={form.email} onChange={set('email')} placeholder="you@business.com" />
        <Field label="Phone number" type="tel" value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
        <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {busy ? 'Creating account…' : 'Create Account &amp; Continue'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-violet-600 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthShell>
  )
}
