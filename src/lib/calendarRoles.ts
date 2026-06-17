import type { Settings } from '../store/settings'

/** Add `id` if absent, remove it if present. Returns a new array. */
export function toggleInArray(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
}

// Each helper returns the settings patch for one cell toggle. The subset
// invariants (work ⊆ blocking, joint ⟹ partnerBlocking, etc.) live here so
// they are testable without rendering the CalendarsPanel.

/** Removing "blocks time" also strips the work flag (work ⊆ blocking). */
export function toggleBlocking(settings: Settings, id: string): Partial<Settings> {
  if (settings.blockingCalendarIds.includes(id)) {
    return {
      blockingCalendarIds: settings.blockingCalendarIds.filter((x) => x !== id),
      workCalendarIds: settings.workCalendarIds.filter((x) => x !== id),
    }
  }
  return { blockingCalendarIds: [...settings.blockingCalendarIds, id] }
}

/** Work ⊆ blocking: a no-op unless the calendar already blocks. */
export function toggleWork(settings: Settings, id: string): Partial<Settings> {
  if (!settings.blockingCalendarIds.includes(id)) return {}
  return { workCalendarIds: toggleInArray(settings.workCalendarIds, id) }
}

export function toggleHoliday(settings: Settings, id: string): Partial<Settings> {
  return { holidayCalendarIds: toggleInArray(settings.holidayCalendarIds, id) }
}

export function toggleDayEvents(settings: Settings, id: string): Partial<Settings> {
  return { dayEventCalendarIds: toggleInArray(settings.dayEventCalendarIds, id) }
}

export function toggleHorizon(settings: Settings, id: string): Partial<Settings> {
  return { horizonCalendarIds: toggleInArray(settings.horizonCalendarIds, id) }
}

/** Per-calendar all-day opt-in: blocks even when the global setting is off. */
export function toggleAllDay(settings: Settings, id: string): Partial<Settings> {
  return { allDayBlockingCalendarIds: toggleInArray(settings.allDayBlockingCalendarIds, id) }
}

// Partner "work" and "joint" ⊆ partner "blocks time", mirroring the personal calendars.

export function togglePartnerBlocking(settings: Settings, id: string): Partial<Settings> {
  if (settings.partnerBlockingCalendarIds.includes(id)) {
    return {
      partnerBlockingCalendarIds: settings.partnerBlockingCalendarIds.filter((x) => x !== id),
      partnerWorkCalendarIds: settings.partnerWorkCalendarIds.filter((x) => x !== id),
      jointCalendarIds: settings.jointCalendarIds.filter((x) => x !== id),
    }
  }
  return { partnerBlockingCalendarIds: [...settings.partnerBlockingCalendarIds, id] }
}

/** Partner work ⊆ partner blocking: a no-op unless the calendar already blocks. */
export function togglePartnerWork(settings: Settings, id: string): Partial<Settings> {
  if (!settings.partnerBlockingCalendarIds.includes(id)) return {}
  return { partnerWorkCalendarIds: toggleInArray(settings.partnerWorkCalendarIds, id) }
}

/** Joint events block the partner too, so marking joint implies partner "blocks time". */
export function toggleJoint(settings: Settings, id: string): Partial<Settings> {
  if (settings.jointCalendarIds.includes(id)) {
    return { jointCalendarIds: settings.jointCalendarIds.filter((x) => x !== id) }
  }
  return {
    jointCalendarIds: [...settings.jointCalendarIds, id],
    partnerBlockingCalendarIds: settings.partnerBlockingCalendarIds.includes(id)
      ? settings.partnerBlockingCalendarIds
      : [...settings.partnerBlockingCalendarIds, id],
  }
}

/** Whether a calendar blocks in any capacity (you, partner, or joint). */
export function blocksAny(settings: Settings, id: string): boolean {
  return (
    settings.blockingCalendarIds.includes(id) ||
    settings.partnerBlockingCalendarIds.includes(id) ||
    settings.jointCalendarIds.includes(id)
  )
}

/**
 * Whether all-day events from this calendar count as busy: either the global
 * setting is on, or the calendar is in the per-calendar opt-in list.
 */
export function allDayOn(settings: Settings, id: string): boolean {
  return settings.blockAllDayEvents || settings.allDayBlockingCalendarIds.includes(id)
}

/** The single auto-derived bucket a calendar lands in for the grouped table. */
export function roleOf(settings: Settings, id: string): 'blocking' | 'other' | 'unused' {
  if (settings.blockingCalendarIds.includes(id)) return 'blocking'
  const other =
    settings.holidayCalendarIds.includes(id) ||
    settings.dayEventCalendarIds.includes(id) ||
    settings.horizonCalendarIds.includes(id) ||
    settings.partnerBlockingCalendarIds.includes(id) ||
    settings.partnerWorkCalendarIds.includes(id) ||
    settings.jointCalendarIds.includes(id)
  return other ? 'other' : 'unused'
}
