// Generates public/icon-192.png and public/icon-512.png — a simple clock
// face on a slate background — with no image dependencies.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y)
      const o = row + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const SLATE = [15, 23, 42]
const GREEN = [52, 211, 153]
const DARK = [6, 78, 59]

function clockPixel(size) {
  const c = size / 2
  const rFace = size * 0.36
  const hand = size * 0.045
  return (x, y) => {
    const dx = x - c
    const dy = y - c
    const dist = Math.hypot(dx, dy)
    if (dist > rFace) return SLATE
    // hour hand pointing up, minute hand pointing right
    const onMinute = Math.abs(dy) < hand && dx >= 0 && dx < rFace * 0.72
    const onHour = Math.abs(dx) < hand && dy <= 0 && -dy < rFace * 0.5
    const onHub = dist < hand * 1.6
    return onMinute || onHour || onHub ? DARK : GREEN
  }
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, clockPixel(size)))
  console.log(`wrote public/icon-${size}.png`)
}
