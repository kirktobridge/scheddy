// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** First selectable (enabled) day cell. */
function firstDayCell(): HTMLButtonElement {
  const cells = screen
    .getAllByRole('button')
    .filter((b) => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled)
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
    expect(await screen.findByText(/unbooked evenings/)).toBeTruthy()

    // The metric selector column is present (left rail) and the right panel is
    // empty until a day is picked.
    await waitFor(() => expect(screen.getByText(/unbooked evenings/)).toBeTruthy())
    expect(screen.getByText(/Pick a day/)).toBeTruthy()

    // Selecting a day fills the right panel with that day's detail card; the
    // metric column stays put.
    await user.click(await waitFor(firstDayCell, { timeout: 3000 }))
    expect(await screen.findByText('today')).toBeTruthy()
    expect(screen.queryByText(/Pick a day/)).toBeNull()
    expect(screen.getByText(/unbooked evenings/)).toBeTruthy()
  })
})
