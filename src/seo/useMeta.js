// Pages declare their search metadata with useMeta(meta). While prerendering, the meta is handed to the build
// through MetaSink; in the browser it replaces the data-seo tags in <head> when the page changes.
import { createContext, useContext, useEffect } from 'react'
import { renderHead } from './meta.js'

export const MetaSink = createContext(null)

export function useMeta(meta) {
  const sink = useContext(MetaSink)
  if (sink && meta) sink.meta = meta
  const key = meta && JSON.stringify(meta)
  useEffect(() => {
    if (!meta) return
    document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
    document.head.append(document.createRange().createContextualFragment(renderHead(meta)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
