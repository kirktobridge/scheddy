/**
 * Subtractive ("paint") color mixing so overlapping metric highlights combine
 * the way pigments do — e.g. blue + yellow = green, not the muddy grey you'd get
 * from averaging RGB. We average the colors in RYB space (red/yellow/blue, the
 * artist's primaries) and convert back to RGB. The RGB↔RYB approximation is the
 * widely-used Gosset/Chen trilinear model, simplified to its component form.
 */

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function rgbToRyb([r, g, b]: RGB): RGB {
  // Remove the whiteness shared by all channels.
  const w = Math.min(r, g, b)
  r -= w; g -= w; b -= w
  const mg = Math.max(r, g, b)
  // Pull out yellow (the red/green overlap).
  let y = Math.min(r, g)
  r -= y; g -= y
  if (b > 0 && g > 0) { b /= 2; g /= 2 }
  y += g; b += g
  // Renormalize so the strongest RYB channel matches the strongest RGB channel.
  const my = Math.max(r, y, b)
  if (my > 0) { const n = mg / my; r *= n; y *= n; b *= n }
  return [r + w, y + w, b + w]
}

function rybToRgb([r, y, b]: RGB): RGB {
  const w = Math.min(r, y, b)
  r -= w; y -= w; b -= w
  const my = Math.max(r, y, b)
  // Pull green out of the yellow/blue overlap.
  let g = Math.min(y, b)
  y -= g; b -= g
  if (b > 0 && g > 0) { b *= 2; g *= 2 }
  r += y; g += y
  const mg = Math.max(r, g, b)
  if (mg > 0) { const n = my / mg; r *= n; g *= n; b *= n }
  return [r + w, g + w, b + w]
}

/**
 * Blend one or more hex colors via RYB averaging. One color passes through
 * unchanged; an empty list returns undefined.
 */
export function mixColors(hexes: string[]): string | undefined {
  if (hexes.length === 0) return undefined
  if (hexes.length === 1) return hexes[0]
  const rybs = hexes.map((h) => rgbToRyb(hexToRgb(h)))
  const avg: RGB = [
    rybs.reduce((s, c) => s + c[0], 0) / rybs.length,
    rybs.reduce((s, c) => s + c[1], 0) / rybs.length,
    rybs.reduce((s, c) => s + c[2], 0) / rybs.length,
  ]
  return rgbToHex(rybToRgb(avg))
}
