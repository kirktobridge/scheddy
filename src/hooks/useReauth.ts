import { useCallback } from 'react'
import { signIn } from '../auth/google'

/**
 * Gesture-driven re-auth for the "sign in again" banner (B-08). signIn() runs
 * inside the returned click handler — a real user gesture, so Google allows the
 * popup — then refresh() re-fetches with the fresh token. A cancelled or failed
 * sign-in leaves the banner in place.
 */
export function useReauth(refresh: () => void | Promise<unknown>) {
  return useCallback(async () => {
    try {
      await signIn()
      void refresh()
    } catch {
      // Nothing to do — the error banner stays until a successful sign-in.
    }
  }, [refresh])
}
