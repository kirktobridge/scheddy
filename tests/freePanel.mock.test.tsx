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

  it('shows metrics by default and swaps to the day card on selection', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)
    expect(await screen.findByText('Availability')).toBeTruthy()

    // Default (no day selected): the panel shows the Metrics block — and only once
    // (the mobile top-of-page metrics are not rendered on desktop).
    await waitFor(() => expect(screen.getAllByText('Metrics')).toHaveLength(1))

    // Selecting a day swaps the panel to that day's detail card.
    await user.click(await waitFor(firstDayCell, { timeout: 3000 }))
    expect(await screen.findByText('today')).toBeTruthy()
    expect(screen.queryByText('Metrics')).toBeNull()
  })

  it('collapse toggle hides the panel content', async () => {
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => expect(screen.getAllByText('Metrics')).toHaveLength(1))

    await user.click(screen.getByLabelText('Collapse panel'))
    expect(screen.queryByText('Metrics')).toBeNull()

    await user.click(screen.getByLabelText('Expand panel'))
    expect(screen.getAllByText('Metrics')).toHaveLength(1)
  })
})
