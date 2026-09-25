import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

const AuthContext = createContext(null)

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok ? { ok: true, user: data.user } : { ok: false, error: data.error || 'Something went wrong. Please try again.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection.' }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSession(d?.user ?? null))
      .catch(() => setSession(null))
      .finally(() => setReady(true))
  }, [])

  async function login({ email, password }) {
    if (!email || !password) return { ok: false, error: 'Enter your email and password.' }
    const res = await post('/api/auth/login', { email, password })
    if (res.ok) setSession(res.user)
    return res
  }

  async function signup(form) {
    const res = await post('/api/auth/signup', form)
    if (res.ok) setSession(res.user)
    return res
  }

  async function logout() {
    await post('/api/auth/logout')
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, ready, login, signup, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function ProtectedRoute({ children }) {
  const { session, ready } = useAuth()
  const location = useLocation()

  if (!ready) return null
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
