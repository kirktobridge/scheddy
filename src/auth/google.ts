import { getSettings } from '../store/settings'

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const TOKEN_KEY = 'scheddy.token'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

interface StoredToken {
  token: string
  expiresAt: number
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback?: (err: { type: string; message?: string }) => void
          }): { requestAccessToken(opts?: { prompt?: string }) : void }
          revoke(token: string, done: () => void): void
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
      document.head.appendChild(script)
    })
  }
  return gisLoading
}

function readStored(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

export function isSignedIn(): boolean {
  const stored = readStored()
  return !!stored && Date.now() < stored.expiresAt - 60_000
}

export function hasEverSignedIn(): boolean {
  return readStored() !== null
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function requestToken(prompt: '' | 'consent'): Promise<string> {
  await loadGis()
  const clientId = getSettings().clientId
  if (!clientId) throw new Error('Set your Google OAuth Client ID in Settings first.')
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(`Google sign-in failed: ${resp.error ?? 'no token returned'}`))
          return
        }
        const stored: StoredToken = {
          token: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
        }
        localStorage.setItem(TOKEN_KEY, JSON.stringify(stored))
        resolve(resp.access_token)
      },
      error_callback: (err) => reject(new Error(`Google sign-in failed: ${err.type}`)),
    })
    client.requestAccessToken({ prompt })
  })
}

/** Returns a valid access token, silently refreshing if possible. */
export async function getAccessToken(): Promise<string> {
  const stored = readStored()
  if (stored && Date.now() < stored.expiresAt - 60_000) return stored.token
  // Token expired (or never obtained): try silent refresh against the existing grant.
  return requestToken('')
}

/** Interactive sign-in from the Settings page button. */
export async function signIn(): Promise<string> {
  return requestToken('consent')
}

export async function signOut(): Promise<void> {
  const stored = readStored()
  clearToken()
  if (stored && window.google?.accounts?.oauth2) {
    await new Promise<void>((resolve) => window.google!.accounts.oauth2.revoke(stored.token, resolve))
  }
}
