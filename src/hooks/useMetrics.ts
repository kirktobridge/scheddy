import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, isSameMonth, startOfMonth } from 'date-fns'
import {
  buildBusy,
  dedupeEvents,
  matchRule,
  unbookedEveningDates,
  unbookedWeekendDayDates,
} from '../lib/metrics'
import { useSettings } from '../store/settings'
import { useEvents } from './useEvents'
import { eventDates, eventStart } from '../lib/format'
import type { GEvent } from '../api/calendar'
import type { MetricRule } from '../store/settings'

export interface RuleResult {
  rule: MetricRule
  matched: GEvent[]
}

export interface Metrics {
  month: Date
  isCurrent: boolean
  loading: boolean
  error: string | null
  eveningDates: string[]
  weekendDates: string[]
  ruleResults: RuleResult[]
  activeKey: string | null
  toggle: (key: string) => void
  /** Dates (yyyy-MM-dd) for the lit metric, for the calendar overlay (null = none). */
  overlay: Set<string> | null
}

/** Month-scoped metrics plus the one toggled overlay shared by the stats and rules blocks. */
export function useMetrics(month: Date): Metrics {
  const [settings] = useSettings()
  // Which metric's overlay is currently lit (null = none).
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const now = new Date()
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const isCurrent = isSameMonth(month, now)

  const { events, loading, error } = useEvents(monthStart.getTime(), monthEnd.getTime())

  const deduped = useMemo(() => (events ? dedupeEvents(events) : []), [events])
  const allDayCalendarIds = useMemo(
    () => new Set(settings.allDayBlockingCalendarIds),
    [settings.allDayBlockingCalendarIds],
  )
  const busy = useMemo(
    () =>
      buildBusy(deduped, {
        rules: settings.metricRules,
        allDay: settings.blockAllDayEvents,
        allDayCalendarIds,
      }),
    [deduped, settings.metricRules, settings.blockAllDayEvents, allDayCalendarIds],
  )

  const computed = useMemo(() => {
    // For the current month count from now forward ("remaining"); for other
    // months count the whole month.
    const from = isCurrent ? now : monthStart
    const opts = { threshold: settings.freeThreshold, now: from }
    return {
      eveningDates: unbookedEveningDates(busy, settings.windows, from, monthEnd, opts),
      weekendDates: unbookedWeekendDayDates(busy, settings.windows, from, monthEnd, opts),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, settings.windows, settings.freeThreshold, isCurrent, monthStart.getTime(), monthEnd.getTime()])

  const ruleResults = useMemo(
    () =>
      settings.metricRules.map((rule) => ({
        rule,
        matched: matchRule(deduped, rule).sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()),
      })),
    [deduped, settings.metricRules],
  )

  // Date set behind each toggleable metric, keyed for the active-overlay lookup.
  const dateSets = useMemo(() => {
    const m = new Map<string, string[]>()
    m.set('evenings', computed.eveningDates)
    m.set('weekend', computed.weekendDates)
    for (const { rule, matched } of ruleResults) {
      m.set(`rule:${rule.id}`, matched.flatMap((ev) => eventDates(ev)))
    }
    return m
  }, [computed, ruleResults])

  const overlay = useMemo(() => {
    const dates = activeKey ? dateSets.get(activeKey) : null
    return dates ? new Set(dates) : null
  }, [activeKey, dateSets])

  // Changing month invalidates any lit overlay.
  useEffect(() => setActiveKey(null), [monthStart.getTime()])

  return {
    month,
    isCurrent,
    loading,
    error,
    eveningDates: computed.eveningDates,
    weekendDates: computed.weekendDates,
    ruleResults,
    activeKey,
    toggle: (key) => setActiveKey((k) => (k === key ? null : key)),
    overlay,
  }
}
