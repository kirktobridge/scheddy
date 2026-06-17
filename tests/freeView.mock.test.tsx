// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** First selectable (enabled) day cell — the grid disables past days, so this is today. */
function firstDayCell(): HTMLButtonElement {
  const cells = screen
    .getAllByRole('button')
    .filter((b) => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled)
  return cells[0] as HTMLButtonElement
}

describe('Free view (mock mode, end-to-end)', () => {
  it('loads the mock calendar and shows a day schedule on selection', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)

    // App boots against the mock API (no auth/network) and the calendar fills in.
    expect(await screen.findByText(/unbooked evenings/)).toBeTruthy()
    const cell = await waitFor(firstDayCell, { timeout: 3000 })

    // Selecting a day reveals the detail card with the Schedule block, because
    // MOCK_SETTINGS tags calendars with "Show events".
    await user.click(cell)
    const schedule = await screen.findByText('Schedule')
    const card = schedule.closest('div')!.parentElement!

    // Either real mock events rendered, or an explicit empty state — never silence.
    const hasRows = within(card).queryAllByRole('listitem').length > 0
    const hasEmpty = within(card).queryByText('Nothing scheduled')
    expect(hasRows || !!hasEmpty).toBe(true)
  })

  it('hides the schedule when no calendars are tagged "Show events"', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />, { dayEventCalendarIds: [] })
    expect(await screen.findByText(/unbooked evenings/)).toBeTruthy()
    const cell = await waitFor(firstDayCell, { timeout: 3000 })
    await user.click(cell)
    // The detail card opens (firstDayCell is today → its relative label is "today"),
    // but with no scoped calendars the Schedule block is absent.
    expect(await screen.findByText('today')).toBeTruthy()
    expect(screen.queryByText('Schedule')).toBeNull()
  })
})
