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
    await screen.findByText(/unbooked evenings/)
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

    // Turning off "★ Top picks" hides all badges.
    await user.click(screen.getByRole('button', { name: /Top picks/ }))
    expect(screen.getByTitle('Next month').textContent).not.toMatch(/★\s*\d/)
  })

  it('drills "★ Top picks" down to a "Top N this week" sub-card', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    // Expanded by default (★ Top picks starts active); the sub-card shows N₂ = 3.
    const sub = await screen.findByRole('button', { name: /Top 3 this week/ })
    expect(sub.getAttribute('aria-pressed')).toBe('false')

    // Toggling the sub-card flips its highlight on.
    await user.click(sub)
    expect(screen.getByRole('button', { name: /Top 3 this week/ }).getAttribute('aria-pressed')).toBe('true')

    // Collapsing "★ Top picks" hides the sub-card.
    await user.click(screen.getByRole('button', { name: /★ Top picks/ }))
    expect(screen.queryByRole('button', { name: /Top 3 this week/ })).toBeNull()
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
    await screen.findByText(/unbooked evenings/)
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

  it('does not deselect when paging away; the metrics panel reverts when no day is in view', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    // Default: the left rail shows the metrics panel.
    expect(screen.getByText(/unbooked evenings/)).toBeTruthy()

    // Select a day → right panel swaps to its card.
    await user.click(firstDayCell(xlCard()))
    await screen.findByText('today')

    // Page away → metrics still shown, selection NOT cleared.
    await user.click(screen.getByTitle('Next month'))
    expect(screen.getByText(/unbooked evenings/)).toBeTruthy()

    // Page back → the same day's card returns (selection persisted).
    await user.click(screen.getByTitle('Previous month'))
    expect(await screen.findByText('today')).toBeTruthy()
  })

  it('Escape clears the selection (panel back to its empty prompt)', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await waitFor(() => screen.getByTitle('Next month'))

    await user.click(firstDayCell(xlCard()))
    await screen.findByText('today')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByText(/Pick a day/)).toBeTruthy())
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
    await screen.findByText(/unbooked evenings/)
    await waitFor(() => firstDayCell())
    // More than one month card is visible.
    expect(screen.getAllByText(/[A-Z][a-z]+ 20\d\d/).length).toBeGreaterThan(1)
  })

  it('dismisses the sheet on a past-threshold swipe down, snaps back below it', async () => {
    mockMatch(false)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await screen.findByText(/unbooked evenings/)

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

describe('Free page horizon — floor/anchor/ceiling', () => {
  /** How many months forward the desktop nav can reach before "Next" disables. */
  async function forwardMonths(user: ReturnType<typeof userEvent.setup>): Promise<number> {
    const next = () => screen.getByTitle('Next month') as HTMLButtonElement
    let count = 0
    for (let i = 0; i < 24 && !next().disabled; i++) {
      await user.click(next())
      count++
    }
    return count
  }

  it('extends the range when horizon calendars have far-out events', async () => {
    mockMatch(true)
    const user = userEvent.setup()

    // Floor only: no horizon calendars → ~7-day window.
    const floor = renderMock(<FreePage />, { horizonCalendarIds: [], minHorizonDays: 7, maxHorizonDays: 120 })
    await waitFor(() => screen.getByTitle('Next month'))
    const floorMonths = await forwardMonths(user)
    floor.unmount()

    // Anchored: the mock "Work" calendar runs ~55 days out → wider window.
    renderMock(<FreePage />, { horizonCalendarIds: ['mock-work'], minHorizonDays: 7, maxHorizonDays: 120 })
    await waitFor(() => screen.getByTitle('Next month'))
    const anchorMonths = await forwardMonths(user)

    expect(anchorMonths).toBeGreaterThan(floorMonths)
  })

  it('caps the range at the ceiling even with far-out anchor events', async () => {
    mockMatch(true)
    const user = userEvent.setup()

    // Ceiling 20 < anchor (~55d): window must cap well short of the anchor.
    renderMock(<FreePage />, { horizonCalendarIds: ['mock-work'], minHorizonDays: 7, maxHorizonDays: 20 })
    await waitFor(() => screen.getByTitle('Next month'))
    const capped = await forwardMonths(user)

    // 20 days reaches at most the next month (≤1 forward step).
    expect(capped).toBeLessThanOrEqual(1)
  })
})
