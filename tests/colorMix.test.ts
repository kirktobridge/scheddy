import { describe, expect, it } from 'vitest'
import { mixColors } from '../src/lib/colorMix'

/** Parse "#rrggbb" → [r,g,b]. */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

describe('mixColors (RYB paint blending)', () => {
  it('passes a single color through unchanged', () => {
    expect(mixColors(['#3b82f6'])).toBe('#3b82f6')
  })

  it('returns undefined for no colors', () => {
    expect(mixColors([])).toBeUndefined()
  })

  it('mixes blue + yellow into a green', () => {
    const [r, g, b] = rgb(mixColors(['#0000ff', '#ffff00'])!)
    // Green dominates: green channel clearly the largest.
    expect(g).toBeGreaterThan(r)
    expect(g).toBeGreaterThan(b)
  })

  it('is order-independent', () => {
    expect(mixColors(['#0000ff', '#ffff00'])).toBe(mixColors(['#ffff00', '#0000ff']))
  })
})
