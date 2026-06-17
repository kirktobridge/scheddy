import type { Settings } from '../../store/settings'

/** Patch function passed to every settings panel. */
export type Update = (patch: Partial<Settings>) => void

export const INPUT =
  'rounded-lg border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
export const INPUT_NESTED =
  'rounded-lg border border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
