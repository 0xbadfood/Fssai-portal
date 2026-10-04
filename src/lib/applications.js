import { useCallback, useEffect, useRef, useState } from 'react'
import { takeLandingSession } from './landingHandoff.js'
import { selectApplication, useSelectedApplicationId } from './selectedApplication.js'

/** The selected application, else the latest one; a stale selection (another account's, deleted) is dropped. */
async function loadSelected(id) {
  if (id) {
    try {
      return await call(`/api/applications/${id}`)
    } catch {
      selectApplication(null)
    }
  }
  return call('/api/applications/current')
}

async function call(path, body) {
  const res = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data.application
}

/**
 * The selected application (else the latest; one is created on first visit).
 * Requests run one at a time, so responses always arrive in the order the actions were taken.
 * Details being edited are kept as a draft: autosaved after a pause, sent along with the next update
 * (e.g. a step change), and flushed when the page is left, so edits are never lost.
 */
export function useApplication() {
  const [app, setApp] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftState, setDraftState] = useState('saved') // 'saved' | 'pending' | 'saving'
  const queue = useRef(Promise.resolve())
  const draft = useRef(null)
  const timer = useRef(null)
  const appId = useRef(null)

  const selected = useSelectedApplicationId()
  useEffect(() => {
    if (app && selected === app.id) return
    let cancelled = false
    loadSelected(selected)
      .then((a) => a || call('/api/applications', { intakeSession: takeLandingSession() }))
      .then((a) => {
        if (cancelled) return
        setApp(a)
        if (a && a.id !== selected) selectApplication(a.id)
      })
      .catch((e) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [selected])
  useEffect(() => {
    appId.current = app?.id
  }, [app?.id])

  const takeDraft = (patch = {}) => {
    clearTimeout(timer.current)
    if (!draft.current) return patch
    const info = { ...draft.current, ...(patch.info || {}) }
    draft.current = null
    return { ...patch, info }
  }

  const run = useCallback((fn, { quiet = false } = {}) => {
    const job = queue.current.then(async () => {
      if (!quiet) setBusy(true)
      setError('')
      try {
        const next = await fn()
        setApp(next)
        return next
      } catch (e) {
        setError(e.message)
        return null
      } finally {
        if (!quiet) setBusy(false)
      }
    })
    queue.current = job
    return job
  }, [])

  const id = app?.id
  const update = (patch) =>
    run(async () => {
      const body = takeDraft(patch)
      setDraftState('saved')
      return call(`/api/applications/${id}/update`, body)
    })

  const saveDraft = (info) => {
    draft.current = info
    setDraftState('pending')
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () =>
        run(
          async () => {
            const body = takeDraft()
            if (!body.info) return appRef.current
            setDraftState('saving')
            const next = await call(`/api/applications/${id}/update`, body)
            if (!draft.current) setDraftState('saved')
            return next
          },
          { quiet: true },
        ),
      1000,
    )
  }

  // Leaving the page (another dashboard page, a reload or closing the tab) flushes unsaved details.
  const appRef = useRef(null)
  appRef.current = app
  useEffect(() => {
    const flush = () => {
      if (!draft.current || !appId.current) return
      const info = draft.current
      draft.current = null
      clearTimeout(timer.current)
      fetch(`/api/applications/${appId.current}/update`, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ info }),
      }).catch(() => {})
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  return {
    app,
    error,
    busy,
    draftState,
    saveDraft,
    update,
    answer: (payload) => run(() => call(`/api/applications/${id}/answer`, payload)),
    reask: (questionId) => run(() => call(`/api/applications/${id}/reask`, { questionId })),
    undo: () => run(() => call(`/api/applications/${id}/undo`, {})),
    restart: () => run(() => call(`/api/applications/${id}/restart`, {})),
    markReady: () => run(() => call(`/api/applications/${id}/ready`, {})),
    // After a document upload: the plan (documents, details read from them) is worked out on the server.
    refresh: () => run(() => call(`/api/applications/${id}`), { quiet: true }),
    rate: (rating, note) =>
      fetch(`/api/applications/${id}/rate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating, note }) }).catch(() => {}),
  }
}

/** Read-only view of the selected application (else the latest; null if none yet). Never creates one. */
export function useCurrentApplication() {
  const selected = useSelectedApplicationId()
  const [state, setState] = useState({ app: undefined, error: '' })
  useEffect(() => {
    let cancelled = false
    loadSelected(selected)
      .then((app) => !cancelled && setState({ app: app || null, error: '' }))
      .catch((e) => !cancelled && setState({ app: null, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [selected])
  return state
}

/** "My applications": summaries, newest first. reload() after creating one. */
export function useApplications() {
  const [state, setState] = useState({ list: undefined, error: '' })
  const reload = useCallback(
    () =>
      fetch('/api/applications', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your applications.'))))
        .then((d) => setState({ list: d.applications, error: '' }))
        .catch((e) => setState({ list: [], error: e.message })),
    [],
  )
  useEffect(() => {
    reload()
  }, [reload])
  return { ...state, reload }
}

/** New application: blank, or for another premises of an existing one (business details carried over). Selects it. */
export async function newApplication({ anotherPremisesOf } = {}) {
  const app = await call('/api/applications', anotherPremisesOf ? { anotherPremisesOf } : {})
  selectApplication(app.id)
  return app
}

/** A short name for an application: its business and place, or a fallback. */
export function applicationName(a) {
  const business = a?.business || a?.info?.legal_name
  const city = a?.premises?.city || a?.info?.city
  return [business || 'New application', city].filter(Boolean).join(' · ')
}
