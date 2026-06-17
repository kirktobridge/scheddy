// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FreePage from '../src/pages/FreePage'
import { renderMock } from './helpers/mockApp'

function firstDayCell(): HTMLButtonElement {
  const cells = screen
    .getAllByRole('button')
    .filter((b) => /^\d{1,2}$/.test(b.textContent?.trim() ?? '') && !(b as HTMLButtonElement).disabled)
  if (!cells[0]) throw new Error('no selectable day cell yet')
  return cells[0] as HTMLButtonElement
}

/** Force all media queries to `matches` (desktop+hover vs mobile). */
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

afterEach(() => {
  // @ts-expect-error reset between tests
  delete window.matchMedia
})

describe('Free page hover preview + selected ring (desktop)', () => {
  it('shows a free-time preview on hover without changing selection', async () => {
    mockMatch(true)
    renderMock(<FreePage />)
    expect(await screen.findByText(/unbooked evenings/)).toBeTruthy()
    const cell = await waitFor(firstDayCell, { timeout: 3000 })

    fireEvent.pointerEnter(cell, { pointerType: 'mouse' })
    // Preview shows a duration ("Xh free") or the fully-booked fallback.
    expect(await screen.findByText(/h free$|Fully booked/)).toBeTruthy()
    // Hovering must not select a day — the panel still shows its empty prompt.
    expect(screen.getByText(/Pick a day/)).toBeTruthy()

    fireEvent.pointerLeave(cell)
    await waitFor(() => expect(screen.queryByText(/h free$|Fully booked/)).toBeNull())
  })

  it('rings the selected cell', async () => {
    mockMatch(true)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    const cell = await waitFor(firstDayCell, { timeout: 3000 })
    await user.click(cell)
    expect(cell.className).toContain('ring-emerald-500')
  })
})

describe('Free page mobile bottom sheet', () => {
  it('opens on tap, toggles closed on a second tap, and closes on Escape', async () => {
    mockMatch(false)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    expect(await screen.findByText(/unbooked evenings/)).toBeTruthy()

    // Tap → sheet dialog with the day card.
    await user.click(await waitFor(firstDayCell, { timeout: 3000 }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('today')).toBeTruthy()

    // Second tap on the same day toggles the sheet closed (exit transition →
    // unmount; jsdom doesn't fire transitionend, so nudge it).
    await user.click(firstDayCell())
    fireEvent.transitionEnd(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Reopen, then Escape dismisses.
    await user.click(firstDayCell())
    const reopened = await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    fireEvent.transitionEnd(reopened)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes when the backdrop is tapped', async () => {
    mockMatch(false)
    const user = userEvent.setup()
    renderMock(<FreePage />)
    await user.click(await waitFor(firstDayCell, { timeout: 3000 }))
    const dialog = await screen.findByRole('dialog')
    const backdrop = dialog.previousElementSibling as HTMLElement
    fireEvent.click(backdrop)
    fireEvent.transitionEnd(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
