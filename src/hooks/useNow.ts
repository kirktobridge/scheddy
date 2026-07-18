import { useCallback, useEffect, useRef, useState } from 'react'

/** Refresh "now" when the tab is revealed after being hidden this long. */
const VISIBILITY_THRESHOLD_MS = 5 * 60 * 1000
/** And on a steady interval while visible, so a left-open PWA doesn't drift. */
const INTERVAL_MS = 30 * 60 * 1000

/**
 * Current wall-clock time, in ms, that re-reads itself so an installed PWA left
 * open overnight doesn't show stale slots (B-02). Bumps on `visibilitychange`
 * (when the tab becomes visible again after >5 min) and every 30 min. The
 * returned `bump` lets callers force a refresh (Refresh button, post-booking).
 */
export function useNow(): [number, () => void] {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const lastRef = useRef(nowMs)
  const bump = useCallback(() => {
    lastRef.current = Date.now()
    setNowMs(lastRef.current)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current > VISIBILITY_THRESHOLD_MS) bump()
    }
    const interval = setInterval(bump, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [bump])

  return [nowMs, bump]
}
