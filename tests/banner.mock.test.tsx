// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBanner } from '../src/components/Banner'

afterEach(cleanup)

describe('ErrorBanner sign-in variant (B-08)', () => {
  it('shows just the message with no button by default', () => {
    render(<ErrorBanner message="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a Sign in button that fires onSignIn', async () => {
    const onSignIn = vi.fn()
    const user = userEvent.setup()
    render(<ErrorBanner message="Session expired — sign in again." onSignIn={onSignIn} />)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(onSignIn).toHaveBeenCalledOnce()
  })
})
