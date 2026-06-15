export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:text-rose-300">
      {message}
    </div>
  )
}

export function Spinner() {
  return <p className="py-8 text-center text-slate-500 dark:text-slate-400">Loading…</p>
}
