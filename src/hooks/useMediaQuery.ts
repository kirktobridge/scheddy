import { useEffect, useState } from 'react'

/**
 * Tracks a CSS media query. Guards `matchMedia` (jsdom lacks it) and defaults to
 * `true` so tests render the desktop layout — the app's primary, supported
 * experience. Mobile-specific tests opt in by mocking `matchMedia` to `false`.
 */
export function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : true
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const on = () => setMatches(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [query])
  return matches
}
