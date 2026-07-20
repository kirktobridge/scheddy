// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** Force every media query to `matches` (desktop). */
function mockMatch(matches: boolean) {
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/** The right-rail Defense section (element holding the "Defense" heading). */
function defenseSection(): HTMLElement {
  return screen.getByRole('heading', { name: 'Defense' }).parentElement as HTMLElement
}

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia
})

describe('B-26 canvas persistence (desktop)', () => {
  it('idle left rail offers next moves — clicking a pick selects its day', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)

    // Idle rail shows actionable picks (each labelled "Xh free"), not a passive
    // "pick a day" prompt.
    const rail = screen.getByText(/Your next moves/).closest('div') as HTMLElement
    const pick = within(rail).getAllByText(/h free$/)[0].closest('button') as HTMLButtonElement
    await user.click(pick)

    // The panel swaps to a day-detail card and the idle rail gives way.
    await waitFor(() => expect(screen.queryByText(/Your next moves/)).toBeNull())
  })

  it('zero free days: the calendar still renders and the rail leads with a red alert', async () => {
    mockMatch(true)
    // An impossible free-ratio threshold empties the pick list without touching
    // the fixtures, so the whole horizon reads as fully booked.
    renderMock(<FreePage />, { freeThreshold: 2 })
    await screen.findByText(/Top picks/)

    // Canvas persists — today's day cell is still rendered on the grid.
    expect(screen.getAllByRole('button').some((b) => b.getAttribute('aria-current') === 'date')).toBe(true)
    // …and the defense rail leads with the zero-free alert row.
    expect(within(defenseSection()).getByText('free days ahead')).toBeTruthy()
    expect(within(defenseSection()).getByText(/nothing open in the next/)).toBeTruthy()
    // The old full-page "Busy life!" bailout is gone on desktop.
    expect(screen.queryByText(/Busy life!/)).toBeNull()
  })
})
