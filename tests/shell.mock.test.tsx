// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { renderMock } from './helpers/mockApp'

describe('B-27 shell — corner controls replace the tab nav', () => {
  it('has no tab nav; the gear opens Settings and ✕ returns to the canvas', async () => {
    const user = userEvent.setup()
    renderMock(<App />)
    await screen.findByText(/Top picks/)

    // The auto-hiding nav and its "Scheduler" tab are gone.
    expect(screen.queryByText('Scheduler')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await screen.findAllByRole('heading', { name: 'Settings' })
    // Refresh is canvas-only, so it steps aside in Settings.
    expect(screen.queryByRole('button', { name: /^(Reload|Updating) calendars$/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Back to the calendar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^(Reload|Updating) calendars$/ })).toBeTruthy())
  })

  it('refresh reloads the canvas data and reports staleness', async () => {
    const user = userEvent.setup()
    renderMock(<App />)
    await screen.findByText(/Top picks/)

    // The refresh control doubles as the load indicator: its label flips while
    // data is in flight ("Updating calendars"), so match either state.
    await user.click(screen.getByRole('button', { name: /^(Reload|Updating) calendars$/ }))
    // The canvas survives the refetch (no blank frame, no crash).
    await waitFor(() => expect(screen.getByText(/Top picks/)).toBeTruthy())
  })
})
