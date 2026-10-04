import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '../lib/auth.jsx'
import { AuthShell, Field } from './LoginPage.jsx'
import PasswordFields from '../components/auth/PasswordFields.jsx'
import { emailProblem, emailSuggestion, mobileProblem, normalizeMobile, passwordProblem } from '../lib/accountRules.js'
import { useMeta } from '../seo/useMeta.js'
import { privateMeta } from '../seo/meta.js'

// The box already shows +91: drop a typed or pasted +91 / 91 / 0 in front, anything that isn't a digit, space or dash,
// and everything after the 10th digit.
function localMobile(v) {
  const s = v.replace(/^\s*\+\s*91[\s-]*/, '').replace(/[^\d\s-]/g, '')
  const d = s.replace(/\D/g, '')
  if ((d.length === 12 && d.startsWith('91')) || (d.length === 11 && d.startsWith('0'))) return d.slice(-10)
  let digits = 0 // keep spaces and dashes, stop at the 10th digit
  return [...s].filter((c) => (/\d/.test(c) ? ++digits <= 10 : digits < 10)).join('')
}

export default function SignupPage() {
  useMeta(privateMeta('Create your free account', '/signup'))
  const { signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState({}) // field → left once, so errors don't shout while typing
  const [submitted, setSubmitted] = useState(false)
  const shown = (key) => submitted || touched[key]
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }))

  const who = { email: form.email, name: form.name, phone: normalizeMobile(form.phone) || form.phone }
  const errors = {
    name: form.name.trim() ? '' : 'Enter your name.',
    email: emailProblem(form.email) || '',
    phone: mobileProblem(form.phone) || '',
    password: passwordProblem(form.password, who) || '',
    confirm: form.confirm === form.password ? '' : 'mismatch',
  }
  const suggestion = !errors.email && emailSuggestion(form.email)

  function set(key) {
    return (v) => setForm((f) => ({ ...f, [key]: v }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    setBusy(true)
    const { confirm, ...fields } = form
    const res = await signup({ ...fields, email: form.email.trim(), phone: normalizeMobile(form.phone) })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const from = location.state?.from
    navigate(from && !from.startsWith('/ops') ? from : '/dashboard', { replace: true })
  }

  return (
    <AuthShell>
      <div className="mb-6 flex items-center gap-2 text-violet-700">
        <UserPlus size={18} />
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Your name" value={form.name} onChange={set('name')} onBlur={blur('name')} placeholder="Rahul Kumar" autoComplete="name" error={shown('name') && errors.name} />
        <div>
          <Field
            label="Email address"
            type="email"
            value={form.email}
            onChange={set('email')}
            onBlur={blur('email')}
            placeholder="you@business.com"
            autoComplete="email"
            error={shown('email') && errors.email}
          />
          {suggestion && (
            <button type="button" onClick={() => set('email')(suggestion)} className="mt-1 text-xs text-amber-700 hover:underline">
              Did you mean <span className="font-semibold">{suggestion}</span>?
            </button>
          )}
        </div>
        <Field
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          prefix="+91"
          value={form.phone}
          onChange={(v) => set('phone')(localMobile(v))}
          onBlur={blur('phone')}
          placeholder="98765 43210"
          autoComplete="tel-national"
          error={shown('phone') && errors.phone}
          hint="Your 10-digit Indian mobile number."
        />
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          onPassword={set('password')}
          onConfirm={set('confirm')}
          who={who}
          showErrors={submitted}
        />
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {busy ? 'Creating account…' : 'Create Account & Continue'}
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
