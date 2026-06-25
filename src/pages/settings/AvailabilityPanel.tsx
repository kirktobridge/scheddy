import { useState } from 'react'
import Section from '../../components/Section'
import SliderField from '../../components/SliderField'
import { DEFAULT_WINDOWS, windowKeys } from '../../lib/availability'
import type { Settings } from '../../store/settings'
import { INPUT, type Update } from './shared'

export default function AvailabilityPanel({ settings, update }: { settings: Settings; update: Update }) {
  const [newWindow, setNewWindow] = useState('')

  const dayStartHour = Number(settings.dayStart.split(':')[0]) || 0

  const addWindow = () => {
    const name = newWindow.trim()
    if (!name || settings.windows[name]) return
    update({ windows: { ...settings.windows, [name]: { start: '09:00', end: '10:00' } } })
    setNewWindow('')
  }

  const removeWindow = (key: string) => {
    if (Object.keys(settings.windows).length <= 1) return
    const next = { ...settings.windows }
    delete next[key]
    update({ windows: next })
  }

  const canAddWindow = newWindow.trim() !== '' && !settings.windows[newWindow.trim()]

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
      <Section title="Time windows">
        {windowKeys(settings.windows).map((key) => (
          <div key={key} className="flex items-center gap-2 text-sm">
            <span className="w-20 shrink-0 truncate capitalize text-slate-700 dark:text-slate-300">{key}</span>
            <input
              type="time"
              value={settings.windows[key].start}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], start: e.target.value } } })
              }
              className={`px-2 py-1 ${INPUT}`}
            />
            <span className="text-slate-500">–</span>
            <input
              type="time"
              value={settings.windows[key].end}
              onChange={(e) =>
                update({ windows: { ...settings.windows, [key]: { ...settings.windows[key], end: e.target.value } } })
              }
              className={`px-2 py-1 ${INPUT}`}
            />
            <button
              onClick={() => removeWindow(key)}
              disabled={Object.keys(settings.windows).length <= 1}
              className="ml-auto rounded-lg bg-rose-500/20 px-2 py-1 text-sm text-rose-600 disabled:opacity-40 dark:text-rose-300"
              aria-label={`Remove ${key}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newWindow}
            onChange={(e) => setNewWindow(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWindow()}
            placeholder="New window name, e.g. lunch"
            className={`flex-1 px-2 py-1 text-sm ${INPUT}`}
          />
          <button
            onClick={addWindow}
            disabled={!canAddWindow}
            className="rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-sm text-slate-500 disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
          >
            + Add
          </button>
        </div>
        <button
          onClick={() => update({ windows: { ...DEFAULT_WINDOWS } })}
          className="text-xs text-slate-500 underline dark:text-slate-400"
        >
          Reset to defaults (morning, afternoon, evening)
        </button>
      </Section>

      <Section title="Availability window">
        <SliderField
          label="Show availability from"
          value={dayStartHour}
          min={0}
          max={24}
          format={(v) => `${String(v).padStart(2, '0')}:00`}
          onChange={(v) => update({ dayStart: `${String(Math.min(23, v)).padStart(2, '0')}:00` })}
        />
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <div className="font-medium">Planning horizon</div>
          <SliderField
            label="Minimum horizon"
            value={settings.minHorizonDays}
            min={7}
            max={settings.maxHorizonDays - 1}
            format={(v) => `${v} days`}
            onChange={(v) => update({ minHorizonDays: Math.min(settings.maxHorizonDays - 1, Math.max(7, v)) })}
          />
          <SliderField
            label="Maximum horizon"
            value={settings.maxHorizonDays}
            min={settings.minHorizonDays + 1}
            max={365}
            format={(v) => `${v} days`}
            onChange={(v) => update({ maxHorizonDays: Math.min(365, Math.max(settings.minHorizonDays + 1, v)) })}
          />
          <p className="text-xs text-slate-500">
            The Free view shows days up to the last event on your horizon calendars, bounded by the min and max above.
            Mark horizon calendars in the Calendars tab.
          </p>
        </div>
        <SliderField
          label="How open must a window be?"
          value={Math.round(settings.freeThreshold * 100)}
          min={0}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) => update({ freeThreshold: v / 100 })}
        />
        <label className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-300">
          All-day events block time
          <input
            type="checkbox"
            checked={settings.blockAllDayEvents}
            onChange={(e) => update({ blockAllDayEvents: e.target.checked })}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Off by default so bill reminders and birthdays don't book your day. Turn it on per calendar with the "All-day"
          pill on the Calendars page, or override individual events with keyword rules on the Metrics page.
        </p>
      </Section>
    </div>
  )
}
