import { useEffect, useState } from 'react'

// Which application the dashboard pages work on, now that an account can have several (one per premises).
// Kept in this browser; an id that isn't the signed-in user's is dropped by the hooks (the server answers 404).
const KEY = 'mfl.application'
const listeners = new Set()

export function getSelectedApplication() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function selectApplication(id) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // private mode: the selection lasts for this page only
  }
  memory = id || null
  listeners.forEach((fn) => fn(memory))
}

let memory = null

/** The selected application id; re-renders when another component selects a different one. */
export function useSelectedApplicationId() {
  const [id, setId] = useState(() => getSelectedApplication() || memory)
  useEffect(() => {
    listeners.add(setId)
    return () => listeners.delete(setId)
  }, [])
  return id
}
