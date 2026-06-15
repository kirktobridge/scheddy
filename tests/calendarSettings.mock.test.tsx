// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderMock } from './helpers/mockApp'
import { MOCK_CALENDARS } from '../src/api/mock'
import { CalendarsPanel } from '../src/pages/SettingsPage'
import { useSettings, type Settings } from '../src/store/settings'

// CalendarsPanel is prop-driven; this wrapper feeds it the live settings store
// so a cell toggle (which calls updateSettings) re-renders with the new state.
function Panel() {
  const [settings, update] = useSettings()
  return <CalendarsPanel signedIn calendars={MOCK_CALENDARS} settings={settings} update={update} />
}

const renderPanel = (overrides: Partial<Settings> = {}) => renderMock(<Panel />, overrides)
const cell = (cal: string, col: string) => screen.getByLabelText(`${cal} — ${col}`)

describe('CalendarsPanel — grouped settings table', () => {
  it('renders all "You" column headers', () => {
    renderPanel()
    for (const label of ['Blocks time', 'Work', 'Holiday', 'Show events', 'All-day']) {
      expect(screen.getByRole('columnheader', { name: label })).toBeTruthy()
    }
  })

  it('shows relationship columns only when relationship mode is on', () => {
    const { unmount } = renderPanel({ relationshipMode: false })
    expect(screen.queryByRole('columnheader', { name: 'Partner busy' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Joint' })).toBeNull()
    unmount()

    renderPanel({ relationshipMode: true })
    for (const label of ['Partner busy', 'Partner work', 'Joint']) {
      expect(screen.getByRole('columnheader', { name: label })).toBeTruthy()
    }
  })

  it('lists every calendar in exactly one row (no duplication in relationship mode)', () => {
    renderPanel({ relationshipMode: true })
    for (const c of MOCK_CALENDARS) {
      expect(screen.getAllByText(c.summary)).toHaveLength(1)
    }
  })

  it('clearing Blocks time strips the Work flag on the same row', async () => {
    const user = userEvent.setup()
    renderPanel()

    // mock-holidays starts with no personal roles.
    await user.click(cell('Holidays (mock)', 'Blocks time'))
    await user.click(cell('Holidays (mock)', 'Work'))
    expect(cell('Holidays (mock)', 'Work').getAttribute('aria-pressed')).toBe('true')

    await user.click(cell('Holidays (mock)', 'Blocks time'))
    expect(cell('Holidays (mock)', 'Work').getAttribute('aria-pressed')).toBe('false')
    expect((cell('Holidays (mock)', 'Work') as HTMLButtonElement).disabled).toBe(true)
  })

  it('marking Joint implies Partner busy', async () => {
    const user = userEvent.setup()
    renderPanel({ relationshipMode: true })

    expect(cell('Holidays (mock)', 'Partner busy').getAttribute('aria-pressed')).toBe('false')
    await user.click(cell('Holidays (mock)', 'Joint'))
    expect(cell('Holidays (mock)', 'Partner busy').getAttribute('aria-pressed')).toBe('true')
  })

  it('starts the Unused group collapsed and expands on click', async () => {
    const user = userEvent.setup()
    // Strip every role so the non-primary calendars fall into "Unused".
    renderPanel({
      blockingCalendarIds: ['mock-personal'],
      workCalendarIds: [],
      holidayCalendarIds: [],
      dayEventCalendarIds: [],
      partnerBlockingCalendarIds: [],
      partnerWorkCalendarIds: [],
      jointCalendarIds: [],
      relationshipMode: false,
    })

    const unused = screen.getByRole('button', { name: /Unused/ })
    expect(unused.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Ana (mock)')).toBeNull()

    await user.click(unused)
    expect(unused.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Ana (mock)')).toBeTruthy()
  })
})
