import React from 'react'
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import Logo from '../components/Logo.jsx'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <Logo to="/" />
      <Compass size={40} className="text-violet-500" />
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you're looking for doesn't exist or may have moved. Let's get you back on track.
      </p>
      <div className="flex gap-3">
        <Link to="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
          Go to Homepage
        </Link>
        <Link to="/dashboard" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
