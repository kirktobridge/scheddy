export default function Section({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800 dark:shadow-none ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
