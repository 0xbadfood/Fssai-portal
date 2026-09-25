import React from 'react'
import Logo from '../Logo.jsx'
import Disclaimer from '../Disclaimer.jsx'
import { BRAND_NAME } from '../../lib/brand.js'

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#services', label: 'Services' },
  { href: '#faq', label: 'FAQ' },
  { href: '/login', label: 'Sign in' },
]

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Logo withTagline={false} />
            <p className="mt-2 text-sm text-slate-500">AI-powered FSSAI licensing, backed by experts.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium text-slate-600 hover:text-violet-600">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="my-8">
          <Disclaimer compact />
        </div>
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 py-5 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-600">Terms of Service</a>
            <a href="#" className="hover:text-slate-600">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
