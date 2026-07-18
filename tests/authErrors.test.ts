// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { AuthRequiredError, getAccessToken } from '../src/auth/google'
import { DEFAULT_SETTINGS, updateSettings } from '../src/store/settings'

const TOKEN_KEY = 'scheddy.token'

/** Install a fake Google Identity Services that resolves silent token requests
 *  one way or the other, so getAccessToken runs without the real GIS script. */
function fakeGis(behavior: 'success' | 'error') {
  ;(window as unknown as { google: unknown }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void
          error_callback?: (e: { type: string }) => void
        }) => ({
          requestAccessToken: () => {
            if (behavior === 'success') config.callback({ access_token: 'fresh', expires_in: 3600 })
            else config.error_callback?.({ type: 'popup_failed_to_open' })
          },
        }),
        revoke: (_t: string, done: () => void) => done(),
      },
    },
  }
}

afterEach(() => {
  localStorage.clear()
  delete (window as unknown as { google?: unknown }).google
  updateSettings(DEFAULT_SETTINGS)
})

describe('getAccessToken auth errors (B-08)', () => {
  it('throws AuthRequiredError when the silent refresh fails', async () => {
    updateSettings({ clientId: 'client-x' })
    fakeGis('error')
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthRequiredError)
  })

  it('returns the token when the silent refresh succeeds', async () => {
    updateSettings({ clientId: 'client-x' })
    fakeGis('success')
    await expect(getAccessToken()).resolves.toBe('fresh')
  })

  it('does not wrap a config error (missing client id) as AuthRequiredError', async () => {
    updateSettings({ clientId: '' })
    fakeGis('error')
    await expect(getAccessToken()).rejects.not.toBeInstanceOf(AuthRequiredError)
  })

  it('uses a valid stored token without any refresh', async () => {
    localStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ token: 'stored', expiresAt: Date.now() + 3_600_000 }),
    )
    // No fake GIS installed — a refresh attempt would throw, proving we didn't.
    await expect(getAccessToken()).resolves.toBe('stored')
  })
})
