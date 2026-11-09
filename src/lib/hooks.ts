import { useCallback, useEffect, useRef, useState } from 'react'

export interface Async<T> {
  data: T | undefined
  error: Error | undefined
  loading: boolean
  reload: () => void
}

/** Runs `load` on mount and whenever `key` changes; ignores results that arrive after a newer request. */
export function useAsync<T>(load: () => Promise<T>, key: string): Async<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean; key: string }>({
    loading: true,
    key,
  })
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadRef.current().then(
      (data) => !cancelled && setState({ data, loading: false, key }),
      (error: Error) => !cancelled && setState({ error, loading: false, key }),
    )
    return () => {
      cancelled = true
    }
  }, [key, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  // While a different key is loading, expose loading=true instead of the previous key's data.
  const stale = state.key !== key
  return {
    data: stale ? undefined : state.data,
    error: stale ? undefined : state.error,
    loading: stale || state.loading,
    reload,
  }
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export interface PageMeta {
  title: string
  description?: string
  image?: string
  noindex?: boolean
}

/** Keeps the tab title and share tags in sync while navigating inside the app (the server renders them for crawlers). */
export function usePageMeta({ title, description, image, noindex }: PageMeta): void {
  useEffect(() => {
    document.title = title
    setMeta('property', 'og:title', title)
    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    if (image) setMeta('property', 'og:image', new URL(image, window.location.origin).href)
    setMeta('property', 'og:url', window.location.origin + window.location.pathname)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
  }, [title, description, image, noindex])
}
