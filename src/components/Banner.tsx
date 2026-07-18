export function ErrorBanner({ message, onSignIn }: { message: string; onSignIn?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:text-rose-300">
      <span>{message}</span>
      {onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="shrink-0 rounded-md bg-rose-600 px-3 py-1 font-bold text-white hover:bg-rose-700"
        >
          Sign in
        </button>
      )}
    </div>
  )
}

export function Spinner() {
  return <p className="py-8 text-center text-slate-500 dark:text-slate-400">Loading…</p>
}
