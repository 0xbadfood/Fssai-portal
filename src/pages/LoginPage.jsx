import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import Disclaimer from '../components/Disclaimer.jsx'
import { useAuth } from '../lib/auth.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await login(form)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  return (
    <AuthShell>
      <div className="mb-6 flex items-center gap-2 text-violet-700">
        <LogIn size={18} />
        <h1 className="text-xl font-bold text-slate-900">Sign in to your account</h1>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@business.com" />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" />
        <div className="-mt-2 text-right">
          <Link to="/forgot-password" className="text-xs font-semibold text-violet-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-violet-600 hover:underline">
          Start Application
        </Link>
      </p>
    </AuthShell>
  )
}

export function Field({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        required
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
      />
    </label>
  )
}

export function AuthShell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50/70 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo to="/" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm">{children}</div>
        <div className="mt-5">
          <Disclaimer compact />
        </div>
      </div>
    </div>
  )
}
