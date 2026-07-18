// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('all good')).toBeTruthy()
  })

  it('renders the recovery panel with the error message on a crash', () => {
    // React logs the caught error to console.error; silence it for the test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something broke.')).toBeTruthy()
    expect(screen.getByText('kaboom')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reset settings' })).toBeTruthy()
    spy.mockRestore()
  })

  it('clears settings and reloads when Reset settings is confirmed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('confirm', () => true)
    Object.defineProperty(window, 'location', {
      value: { reload },
      writable: true,
    })
    localStorage.setItem('scheddy.settings', '{"theme":"light"}')
    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Reset settings' }))

    expect(localStorage.getItem('scheddy.settings')).toBeNull()
    expect(reload).toHaveBeenCalled()
    vi.unstubAllGlobals()
    spy.mockRestore()
  })
})
