// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { addDays, startOfDay } from 'date-fns'
import DayTimelineCard from '../src/components/DayTimelineCard'
import { mockEventsMulti } from '../src/api/mock'
import { eventsForDay, fmtDay } from '../src/lib/format'
import { windowKeys } from '../src/lib/availability'
import { DEFAULT_SETTINGS } from '../src/store/settings'
import { mockCalendarColors } from './helpers/mockApp'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// "Trip to Tokyo" is an all-day mock event spanning today+10..+14 on mock-personal.
function tripDay() {
  return ymd(addDays(startOfDay(new Date()), 11))
}

function renderCard(date: string) {
  const windows = DEFAULT_SETTINGS.windows
  const events = eventsForDay(
    mockEventsMulti(
      ['mock-personal', 'mock-work', 'mock-us', 'mock-partner'],
      addDays(new Date(), -30),
      addDays(new Date(), 60),
    ),
    date,
  )
  render(
    <DayTimelineCard
      date={date}
      slots={[]}
      windows={windows}
      busy={[]}
      now={new Date()}
      dayStart="08:00"
      windowOrder={windowKeys(windows)}
      dayInfo={() => ({})}
      slotInfo={() => ({})}
      events={events}
      calendarColors={mockCalendarColors}
    />,
  )
  return events
}

describe('DayTimelineCard schedule (mock data)', () => {
  it('lists the day\'s mock events with calendar-colored dots', () => {
    const date = tripDay()
    const events = renderCard(date)

    // Sanity: the mock fixture really does put Trip to Tokyo on this day.
    expect(events.some((e) => e.summary === 'Trip to Tokyo')).toBe(true)

    // Header + schedule render.
    expect(screen.getByText(fmtDay(date))).toBeTruthy()
    expect(screen.getByText('Schedule')).toBeTruthy()

    // The all-day Trip row shows "all day" and a dot in mock-personal's color.
    const row = screen.getByText('Trip to Tokyo').closest('li')!
    expect(within(row).getByText('all day')).toBeTruthy()
    const dot = row.querySelector('span[style]') as HTMLElement
    expect(dot.style.backgroundColor).toBe('rgb(16, 185, 129)') // #10b981 = mock-personal
  })

  it('shows "Nothing scheduled" for a clear day when the schedule is enabled', () => {
    // A far-future day with no seeded events, but events !== undefined (scope on).
    const date = ymd(addDays(startOfDay(new Date()), 200))
    render(
      <DayTimelineCard
        date={date}
        slots={[]}
        windows={DEFAULT_SETTINGS.windows}
        busy={[]}
        now={new Date()}
        dayStart="08:00"
        windowOrder={windowKeys(DEFAULT_SETTINGS.windows)}
        dayInfo={() => ({})}
        slotInfo={() => ({})}
        events={[]}
        calendarColors={mockCalendarColors}
      />,
    )
    expect(screen.getByText('Nothing scheduled')).toBeTruthy()
  })

  it('hides the schedule entirely when events is undefined (scope off)', () => {
    render(
      <DayTimelineCard
        date={tripDay()}
        slots={[]}
        windows={DEFAULT_SETTINGS.windows}
        busy={[]}
        now={new Date()}
        dayStart="08:00"
        windowOrder={windowKeys(DEFAULT_SETTINGS.windows)}
        dayInfo={() => ({})}
        slotInfo={() => ({})}
      />,
    )
    expect(screen.queryByText('Schedule')).toBeNull()
  })
})
