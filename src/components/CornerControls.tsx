/**
 * The app's only chrome (B-27): a quiet icon cluster in the top-right corner.
 * With Check dissolved into the canvas query layer there are no tabs left to
 * navigate — just the canvas, a way into Settings, and a manual refresh that
 * doubles as the staleness indicator.
 */
export default function CornerControls({
  onSettings,
  settingsOpen,
  onRefresh,
  busy = false,
}: {
  onSettings: () => void
  settingsOpen: boolean
  onRefresh: () => void
  /** Data is loading or being revalidated — the refresh icon glows instead of a banner. */
  busy?: boolean
}) {
  const btn =
    'rounded-lg px-2 py-1 text-base leading-none text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200'
  return (
    <div className="flex items-center justify-end gap-0.5">
      {!settingsOpen && (
        <button
          type="button"
          onClick={onRefresh}
          title={busy ? 'Updating calendars…' : 'Reload calendars'}
          aria-label={busy ? 'Updating calendars' : 'Reload calendars'}
          className={`${btn} ${busy ? 'animate-pulse text-amber-500 dark:text-amber-400' : ''}`}
        >
          ↻
        </button>
      )}
      <button
        type="button"
        onClick={onSettings}
        title={settingsOpen ? 'Back to the calendar' : 'Settings'}
        aria-label={settingsOpen ? 'Back to the calendar' : 'Settings'}
        className={btn}
      >
        {settingsOpen ? '×' : '⚙️'}
      </button>
    </div>
  )
}
