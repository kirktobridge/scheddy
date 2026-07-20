// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** Today's day cell. */
function firstDayCell(): HTMLButtonElement {
  const cells = screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-current') === 'date')
  return cells[0] as HTMLButtonElement
}

/** Force the xl: media query to match so FreePage renders the desktop panel. */
function mockDesktop(matches: boolean) {
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

describe('Free view desktop panel (mock mode)', () => {
  beforeEach(() => mockDesktop(true))
  afterEach(() => {
    // @ts-expect-error reset between tests
    delete window.matchMedia
  })

  it('shows the metric panel; the right panel holds the day card on selection', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)
    expect(await screen.findByText(/Top picks/)).toBeTruthy()

    // The metric selector column is present (left rail) and the left panel shows
    // the idle "next moves" rail (B-26) until a day is picked.
    await waitFor(() => expect(screen.getByText(/Top picks/)).toBeTruthy())
    expect(screen.getByText(/Your next moves/)).toBeTruthy()

    // Selecting a day fills the panel with that day's detail card; the idle rail
    // gives way and the metric column stays put.
    await user.click(await waitFor(firstDayCell, { timeout: 3000 }))
    expect(await screen.findByText('today')).toBeTruthy()
    expect(screen.queryByText(/Your next moves/)).toBeNull()
    expect(screen.getByText(/Top picks/)).toBeTruthy()
  })
})
