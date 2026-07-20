// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** The query mode bar mounts in the calendar header once data loads. */
async function waitForCalendar() {
  await waitFor(() => expect(screen.getByText('When are we free?')).toBeTruthy(), { timeout: 3000 })
}

describe('Query layer (mock mode, replaces CheckPage)', () => {
  it('activates a query, lists free slots in the rail, and clears back to idle', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitForCalendar()

    // Idle: the left rail shows the day-card placeholder, no results panel.
    expect(screen.getByText(/Your next moves/)).toBeTruthy()

    // Activate a whole-month query (broad range → results in the mock horizon).
    await user.click(screen.getByRole('button', { name: 'This month' }))

    // The rail switches to the query results with a range header and a Clear control.
    const clear = await screen.findByRole('button', { name: 'Clear query' })
    const panel = clear.closest('div')!.parentElement!.parentElement as HTMLElement
    expect(within(panel).getByText(/When are we (both )?free\?/)).toBeTruthy()
    // Either matching slots render, or the honest empty state — never silence.
    const hasSlots = within(panel).queryAllByRole('listitem').length > 0
    const hasEmpty = within(panel).queryByText('No free slots in this range.')
    expect(hasSlots || !!hasEmpty).toBe(true)

    // Clearing returns the rail to idle.
    await user.click(clear)
    await waitFor(() => expect(screen.getByText(/Your next moves/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Clear query' })).toBeNull()
  })

  it('offers the "Both of us" chip in relationship mode (mock is a couple)', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitForCalendar()

    const both = screen.getByRole('button', { name: /Both of us/ })
    expect(both.getAttribute('aria-pressed')).toBe('false')
    await user.click(both)
    expect(both.getAttribute('aria-pressed')).toBe('true')

    // With a query active, the mutual-availability heading appears in the rail.
    await user.click(screen.getByRole('button', { name: 'This month' }))
    expect(await screen.findByText('When are we both free?')).toBeTruthy()
  })

  it('hides the "Both of us" chip when relationship mode is off', async () => {
    renderMock(<FreePage />, { relationshipMode: false })
    await waitForCalendar()
    expect(screen.queryByRole('button', { name: /Both of us/ })).toBeNull()
  })
})
