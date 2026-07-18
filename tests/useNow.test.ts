// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNow } from '../src/hooks/useNow'

const MIN = 60 * 1000

function fireVisibility() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useNow', () => {
  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current[0]).toBe(Date.now())
  })

  it('bumps on the 30-minute interval', () => {
    const { result } = renderHook(() => useNow())
    const t0 = result.current[0]
    act(() => {
      vi.advanceTimersByTime(30 * MIN)
    })
    expect(result.current[0]).toBe(t0 + 30 * MIN)
  })

  it('refreshes on visibilitychange only after >5 min hidden', () => {
    const { result } = renderHook(() => useNow())
    const t0 = result.current[0]

    // Under the threshold — no refresh.
    act(() => {
      vi.advanceTimersByTime(3 * MIN)
    })
    fireVisibility()
    expect(result.current[0]).toBe(t0)

    // Past the threshold — refreshes to the current time.
    act(() => {
      vi.advanceTimersByTime(3 * MIN)
    })
    fireVisibility()
    expect(result.current[0]).toBe(t0 + 6 * MIN)
  })

  it('bump() forces a refresh to now', () => {
    const { result } = renderHook(() => useNow())
    const t0 = result.current[0]
    act(() => {
      vi.advanceTimersByTime(90 * 1000)
    })
    act(() => {
      result.current[1]()
    })
    expect(result.current[0]).toBe(t0 + 90 * 1000)
  })

  it('removes listeners on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useNow())
    unmount()
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
