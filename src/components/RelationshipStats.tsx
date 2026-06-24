import StatCard from './StatCard'

interface Props {
  partnerName: string
  /** Full-width single-row layout (desktop selector bar) instead of a grid. */
  bar?: boolean
  /** Compact 2-column side-panel column (the desktop left rail). */
  panel?: boolean
  /** Slate card backgrounds, for sitting inside the white calendar card. */
  tinted?: boolean
  // Counts
  partnerOff: number
  overlapTotal: number
  overlapWeekends: number
  overlapWeeknights: number
  bothOff: number
  dateOptions: number
  // Highlight colors (semantic tokens; edited in Settings → Colors)
  partnerOffColor: string
  overlapColor: string
  dateColor: string
  // Active flags
  showNotWorking: boolean
  showOverlap: boolean
  showOverlapWeekends: boolean
  showOverlapWeeknights: boolean
  showOverlapOffDays: boolean
  showDates: boolean
  // Toggles
  onToggleNotWorking: () => void
  onToggleOverlap: () => void
  onToggleWeekends: () => void
  onToggleWeeknights: () => void
  onToggleOffDays: () => void
  onToggleDates: () => void
  // Date cadence
  overdue: boolean
  nudgeTitle?: string
}

const OverdueBadge = () => (
  <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-medium text-pink-950">Overdue</span>
)

/** "Me & {Partner}" relationship overlays rendered as metric-style cards. */
export default function RelationshipStats({
  partnerName,
  bar,
  panel,
  tinted,
  partnerOff,
  overlapTotal,
  overlapWeekends,
  overlapWeeknights,
  bothOff,
  dateOptions,
  partnerOffColor,
  overlapColor,
  dateColor,
  showNotWorking,
  showOverlap,
  showOverlapWeekends,
  showOverlapWeeknights,
  showOverlapOffDays,
  showDates,
  onToggleNotWorking,
  onToggleOverlap,
  onToggleWeekends,
  onToggleWeeknights,
  onToggleOffDays,
  onToggleDates,
  overdue,
  nudgeTitle,
}: Props) {
  const cardClass = bar ? 'min-w-0 flex-1' : ''
  const compact = bar || panel
  const square = !!panel
  const rowClass = bar ? 'flex gap-2' : 'grid grid-cols-2 gap-2'
  return (
    <section className={bar ? 'min-w-0 space-y-2' : 'space-y-2'} style={bar ? { flexBasis: 0, flexGrow: 3 } : undefined}>
      {bar || panel ? (
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Me &amp; {partnerName}
        </h2>
      ) : (
        <h2 className="text-xl font-bold">Me &amp; {partnerName}</h2>
      )}
      <div className={rowClass}>
        <StatCard
          value={partnerOff}
          label={`${partnerName} off work`}
          active={showNotWorking}
          color={partnerOffColor}
          dense={compact}
          square={square}
          tinted={tinted}
          wrapperClass={cardClass}
          onClick={onToggleNotWorking}
        />
        <StatCard
          value={overlapTotal}
          label="⇄ Our Overlap"
          active={showOverlap}
          color={overlapColor}
          dense={compact}
          square={square}
          tinted={tinted}
          wrapperClass={cardClass}
          title="Days with enough mutual free time — tap for sub-filters"
          onClick={onToggleOverlap}
        />
        <StatCard
          value={dateOptions}
          label="❤️ Date Options"
          active={showDates}
          color={dateColor}
          dense={compact}
          square={square}
          tinted={tinted}
          wrapperClass={cardClass}
          title={nudgeTitle}
          footer={overdue ? <OverdueBadge /> : undefined}
          onClick={onToggleDates}
        />
      </div>
      {showOverlap && (
        <div className={`${rowClass} border-t border-slate-200 pt-2 dark:border-slate-700`}>
          <StatCard
            value={overlapWeekends}
            label="Weekends"
            active={showOverlapWeekends}
            color={overlapColor}
            dense={compact}
            square={square}
            wrapperClass={cardClass}
            onClick={onToggleWeekends}
          />
          <StatCard
            value={overlapWeeknights}
            label="Weeknights"
            active={showOverlapWeeknights}
            color={overlapColor}
            dense={compact}
            square={square}
            wrapperClass={cardClass}
            onClick={onToggleWeeknights}
          />
          <StatCard
            value={bothOff}
            label="Both off"
            active={showOverlapOffDays}
            color={overlapColor}
            dense={compact}
            square={square}
            wrapperClass={cardClass}
            onClick={onToggleOffDays}
          />
        </div>
      )}
    </section>
  )
}
