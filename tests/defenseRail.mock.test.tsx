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

/** The right-rail Defense section (the element holding the "Defense" heading). */
function defenseSection(): HTMLElement {
  return screen.getByRole('heading', { name: 'Defense' }).parentElement as HTMLElement
}

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia
})

describe('B-25 right rail — layers legend + defense column (desktop)', () => {
  it('renders both the Layers legend and the Defense column', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)
    expect(screen.getByRole('heading', { name: 'Layers' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Defense' })).toBeTruthy()
  })

  it('phrases a count defensively as a status row', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)
    // "N free weekend days left in <Month>" — the scoreboard count, reframed.
    expect(within(defenseSection()).getByText(/free weekend days? .*in \w+/)).toBeTruthy()
  })

  it('a defense-row Show verb toggles its canvas layer (Show ⇄ Hide)', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)

    const weekendRow = within(defenseSection())
      .getByText(/free weekend days? .*in \w+/)
      .closest('div')!.parentElement as HTMLElement
    const verb = within(weekendRow).getByRole('button')
    expect(verb.textContent).toBe('Show')
    expect(verb.getAttribute('aria-pressed')).toBe('false')

    await user.click(verb)
    expect(within(weekendRow).getByRole('button').textContent).toBe('Hide')
    expect(within(weekendRow).getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('promotes the date cadence to a first-class rhythm line (relationship mode)', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)
    // The cadence, no longer a tooltip: "Last date …" with a due/overdue detail.
    expect(within(defenseSection()).getByText(/^Last date/)).toBeTruthy()
    expect(within(defenseSection()).getByText(/due in \d+|overdue by \d+|no date yet|no cadence set/)).toBeTruthy()
  })

  it('a legend toggle drives a canvas overlay ring', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    const { container } = renderMock(<FreePage />)
    await screen.findByText(/Top picks/)

    // "unbooked evenings" is a legend toggle now; lighting it tints matching cells.
    const legendToggle = screen.getByRole('button', { name: /unbooked evenings/ })
    expect(legendToggle.getAttribute('aria-pressed')).toBe('false')
    await user.click(legendToggle)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /unbooked evenings/ }).getAttribute('aria-pressed')).toBe('true'),
    )
    // At least one calendar cell now carries a metric tint overlay (inline bg color).
    await waitFor(() =>
      expect(container.querySelector('[style*="background-color"]')).toBeTruthy(),
    )
  })
})
