// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

/** Force every media query to `matches` (desktop+fine-pointer vs mobile). */
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

/** First enabled day cell, optionally scoped to a container. Throws (so waitFor
 *  retries) until the mock calendar has loaded. */
function firstDayCell(root: HTMLElement | typeof screen = screen): HTMLButtonElement {
  const scope = root === screen ? screen : within(root as HTMLElement)
  const cells = scope
    .getAllByRole('button')
    .filter((b) => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled)
  if (!cells[0]) throw new Error('no selectable day cell yet')
  return cells[0] as HTMLButtonElement
}

/** The xl single-month card (the element holding the prev/next nav). */
function xlCard(): HTMLElement {
  return screen.getByTitle('Next month').closest('div')!.parentElement as HTMLElement
}

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia
})

describe('Free page regression — desktop', () => {
  it('keeps month nav within [now, maxDate]', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText('Availability')
    await waitFor(() => screen.getByTitle('Next month'))

    const prev = screen.getByTitle('Previous month') as HTMLButtonElement
    const next = screen.getByTitle('Next month') as HTMLButtonElement
    // On the now-month, prev is pinned.
    expect(prev.disabled).toBe(true)
    expect(next.disabled).toBe(false)

    // Page forward to the end of the window — next eventually disables, prev frees.
    for (let i = 0; i < 12 && !next.disabled; i++) await user.click(next)
    expect(next.disabled).toBe(true)
    expect((screen.getByTitle('Previous month') as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows a ★ pick badge on a nav arrow, gated by the ★ Top toggle', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    // At least one arrow should advertise picks in its target month.
    const badged = ['Previous month', 'Next month'].some((t) =>
      /★\s*\d/.test(screen.getByTitle(t).textContent ?? ''),
    )
    expect(badged).toBe(true)

    // Turning off "★ Top" hides all badges.
    await user.click(screen.getByRole('button', { name: /Top \d/ }))
    expect(screen.getByTitle('Next month').textContent).not.toMatch(/★\s*\d/)
  })

  it('drops the selected-cell ring after navigating away from its month', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    await user.click(firstDayCell(xlCard()))
    // A ringed cell exists in the viewed month.
    expect(xlCard().querySelector('.ring-emerald-500')).toBeTruthy()

    await user.click(screen.getByTitle('Next month'))
    // Selected day is no longer in view → no ring in the single grid.
    expect(xlCard().querySelector('.ring-emerald-500')).toBeNull()
  })

  it('flips the hover popover above the cell near the viewport bottom', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    await screen.findByText('Availability')
    const cell = await waitFor(() => firstDayCell())

    cell.getBoundingClientRect = () =>
      ({ top: 688, bottom: 700, left: 100, right: 140, width: 40, height: 12, x: 100, y: 688, toJSON: () => ({}) }) as DOMRect
    fireEvent.pointerEnter(cell, { pointerType: 'mouse' })
    const above = (await screen.findByText(/h free$|Fully booked/)).parentElement as HTMLElement
    expect(above.getAttribute('style')).toContain('translateY(-100%)')
    fireEvent.pointerLeave(cell)
    await waitFor(() => expect(screen.queryByText(/h free$|Fully booked/)).toBeNull())

    cell.getBoundingClientRect = () =>
      ({ top: 80, bottom: 100, left: 100, right: 140, width: 40, height: 12, x: 100, y: 80, toJSON: () => ({}) }) as DOMRect
    fireEvent.pointerEnter(cell, { pointerType: 'mouse' })
    const below = (await screen.findByText(/h free$|Fully booked/)).parentElement as HTMLElement
    expect(below.getAttribute('style')).not.toContain('translateY(-100%)')
  })

  it('does not deselect when paging away, and metrics follow the viewed month', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    // Default: panel shows current-month metrics ("…left" phrasing).
    expect(screen.getByText(/unbooked evenings left/)).toBeTruthy()

    // Select a day → panel swaps to its card.
    await user.click(firstDayCell(xlCard()))
    await screen.findByText('today')

    // Page away → panel reverts to metrics (selection NOT cleared) for the new
    // month ("…left" gone since it's no longer the current month).
    await user.click(screen.getByTitle('Next month'))
    await waitFor(() => expect(screen.queryByText(/unbooked evenings left/)).toBeNull())
    expect(screen.getByText(/unbooked evenings/)).toBeTruthy()

    // Page back → the same day's card returns (selection persisted).
    await user.click(screen.getByTitle('Previous month'))
    expect(await screen.findByText('today')).toBeTruthy()
  })

  it('preserves the panel scroll container across month nav, remounts it on swap', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    const aside = screen.getByLabelText('Collapse panel').parentElement as HTMLElement
    const c1 = aside.querySelector('.overflow-y-auto')
    // Metrics → metrics across nav: same node (key={panelMode} stable).
    await user.click(screen.getByTitle('Next month'))
    expect(aside.querySelector('.overflow-y-auto')).toBe(c1)
    // Metrics → day: content type swap remounts the container.
    await user.click(firstDayCell(xlCard()))
    expect(aside.querySelector('.overflow-y-auto')).not.toBe(c1)
  })

  it('Escape clears the selection (panel back to metrics)', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    await user.click(firstDayCell(xlCard()))
    await screen.findByText('today')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByText('Metrics')).toBeTruthy())
    expect(screen.queryByText('today')).toBeNull()
  })

  it('runs the day planner inside the panel (relationship mode)', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    await user.click(firstDayCell(xlCard()))
    await user.click(await screen.findByText('Plan date'))
    // Planner open → Book / Cancel actions render.
    expect(await screen.findByText('Book')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })
})

describe('Free page regression — mobile', () => {
  beforeAll(() => {
    // jsdom lacks pointer-capture; the sheet's swipe handler needs no-op stubs.
    if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
    if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
    if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  })

  it('keeps the multi-month compact layout below xl', async () => {
    mockMatch(false)
    renderMock(<FreePage />)
    await screen.findByText('Availability')
    await waitFor(() => firstDayCell())
    // More than one month card is visible.
    expect(screen.getAllByText(/[A-Z][a-z]+ 20\d\d/).length).toBeGreaterThan(1)
  })

  it('dismisses the sheet on a past-threshold swipe down, snaps back below it', async () => {
    mockMatch(false)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText('Availability')

    // Open, then swipe the handle down past the 80px threshold → closes.
    await user.click(await waitFor(() => firstDayCell()))
    const dialog = await screen.findByRole('dialog')
    const handle = screen.getByLabelText('Close')
    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 120, pointerId: 1 })
    fireEvent.transitionEnd(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Reopen; a short drag (< 80px) snaps back — sheet stays open.
    await user.click(firstDayCell())
    const dialog2 = await screen.findByRole('dialog')
    const handle2 = screen.getByLabelText('Close')
    fireEvent.pointerDown(handle2, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle2, { clientY: 30, pointerId: 1 })
    fireEvent.pointerUp(handle2, { clientY: 30, pointerId: 1 })
    expect(within(dialog2).getByText('today')).toBeTruthy()
  })
})
