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

  it('phrases a count defensively as a number-led status row', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)
    // Number-led: a "free weekend days" label with a "left in <Month>" scope line.
    const weekendRow = within(defenseSection()).getByText('free weekend days').closest('.rounded-xl') as HTMLElement
    expect(within(weekendRow).getByText(/(left )?in \w+/)).toBeTruthy()
  })

  it('a defense-row Show verb toggles its canvas layer (Show ⇄ Hide)', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)

    const weekendRow = within(defenseSection()).getByText('free weekend days').closest('.rounded-xl') as HTMLElement
    const verb = within(weekendRow).getByRole('button')
    expect(verb.textContent).toBe('Show')
    expect(verb.getAttribute('aria-pressed')).toBe('false')

    await user.click(verb)
    expect(within(weekendRow).getByRole('button').textContent).toBe('Hide')
    expect(within(weekendRow).getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('promotes the date cadence to a first-class rhythm row (relationship mode)', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText(/Top picks/)
    // The cadence, no longer a tooltip: a due/overdue hero row with a "last …" line.
    expect(within(defenseSection()).getByText(/overdue for a date|to next date|date cadence/)).toBeTruthy()
    expect(within(defenseSection()).getByText(/^last /)).toBeTruthy()
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
