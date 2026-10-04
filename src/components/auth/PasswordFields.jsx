import React, { useState } from 'react'
import { Check, Eye, EyeOff, X } from 'lucide-react'
import { Field } from '../../pages/LoginPage.jsx'
import { passwordChecks, passwordStrength } from '../../lib/accountRules.js'

const STRENGTH = [
  { label: 'Too weak', bar: 'bg-red-400', text: 'text-red-600' },
  { label: 'Okay', bar: 'bg-amber-400', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-lime-500', text: 'text-lime-700' },
  { label: 'Strong', bar: 'bg-green-600', text: 'text-green-700' },
]

/** New password + confirmation, with the rules as a live checklist and a strength bar.
 * `who`: { email, name, phone } typed so far, so the password can't reuse them. `showErrors`: after a submit attempt. */
export default function PasswordFields({ password, confirm, onPassword, onConfirm, who, showErrors, label = 'Password' }) {
  const [visible, setVisible] = useState(false)
  const checks = passwordChecks(password, who)
  const strength = passwordStrength(password, who)
  const s = STRENGTH[strength]
  // Flag a mismatch once they've typed as much as the password (or tried to submit), not on every keystroke.
  const mismatch = !!confirm && confirm !== password && (confirm.length >= password.length || showErrors)
  const toggle = (
    <button type="button" onClick={() => setVisible((v) => !v)} className="px-3 text-slate-400 hover:text-slate-600" aria-label={visible ? 'Hide password' : 'Show password'}>
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )
  return (
    <>
      <div>
        <Field
          label={label}
          type={visible ? 'text' : 'password'}
          value={password}
          onChange={onPassword}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          end={toggle}
          error={showErrors && strength === 0 ? 'Your password doesn’t meet the rules below yet.' : ''}
        />
        {password && (
          <div className="mt-2 flex items-center gap-2" aria-live="polite">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${strength >= i || (strength === 0 && i === 1) ? s.bar : 'bg-slate-100'}`} />
              ))}
            </div>
            <span className={`w-16 text-right text-xs font-semibold ${s.text}`}>{s.label}</span>
          </div>
        )}
        <ul className="mt-2 space-y-1">
          {checks.map((c) => (
            <li key={c.id} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-green-700' : showErrors ? 'text-red-600' : 'text-slate-500'}`}>
              {c.ok ? <Check size={13} /> : <X size={13} className={showErrors ? '' : 'text-slate-300'} />}
              {c.label}
            </li>
          ))}
          {strength > 0 && strength < 3 && <li className="text-xs text-slate-400">Longer, with capitals and a symbol, is stronger.</li>}
        </ul>
      </div>
      <Field
        label="Confirm password"
        type={visible ? 'text' : 'password'}
        value={confirm}
        onChange={onConfirm}
        placeholder="Type it again"
        autoComplete="new-password"
        error={mismatch || (showErrors && !confirm) ? (confirm ? 'The passwords don’t match.' : 'Type your password again.') : ''}
        hint={confirm && confirm === password ? '✓ Passwords match' : ''}
      />
    </>
  )
}
