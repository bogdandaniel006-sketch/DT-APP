/**
 * Line detection on a scanned page (no vector content): a progressive
 * probabilistic Hough transform finds straight strokes in the dark pixels, then
 * each one is refined with a least-squares fit of its pixels for sub-pixel
 * precision. Pure computation: runs inside a Web Worker.
 */

export interface RasterInput {
  /** RGBA pixels. */
  data: Uint8ClampedArray
  width: number
  height: number
  /** Pixels per document point. */
  scale: number
  /** Shortest stroke to report, in px. */
  minLength: number
}

/** Segments in document coordinates: [ax, ay, bx, by] per segment. */
export type RasterSegments = number[][]

const ANGLES = 360
const MAX_GAP = 3
const THRESHOLD = 30
const CORRIDOR = 2.2
const MIN_DENSITY = 0.82

/** Deterministic shuffle so detection is reproducible. */
const shuffle = (arr: Int32Array) => {
  let seed = 1234567
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const j = seed % (i + 1)
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
}

export const detectRasterLines = ({ data, width, height, scale, minLength }: RasterInput): RasterSegments => {
  const n = width * height
  const dark = new Uint8Array(n)
  let count = 0
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const luma = 0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]!
    if (luma < 150) {
      dark[i] = 1
      count++
    }
  }
  // Mostly-dark images (photos, heavy shading) are not line drawings.
  if (count === 0 || count > n * 0.25) return []

  const mask = dark.slice()
  const voted = new Uint8Array(n)
  const cos = new Float64Array(ANGLES)
  const sin = new Float64Array(ANGLES)
  for (let k = 0; k < ANGLES; k++) {
    cos[k] = Math.cos((k * Math.PI) / ANGLES)
    sin[k] = Math.sin((k * Math.PI) / ANGLES)
  }
  const numRho = Math.ceil(Math.hypot(width, height)) * 2 + 1
  const offset = (numRho - 1) / 2
  const acc = new Int32Array(ANGLES * numRho)

  const points = new Int32Array(count)
  for (let i = 0, k = 0; i < n; i++) if (dark[i]) points[k++] = i
  shuffle(points)

  const vote = (x: number, y: number, delta: number) => {
    let best = 0
    let bestK = 0
    for (let k = 0; k < ANGLES; k++) {
      const r = Math.round(x * cos[k]! + y * sin[k]!) + offset
      const idx = k * numRho + r
      const v = (acc[idx] = acc[idx]! + delta)
      if (v > best) {
        best = v
        bestK = k
      }
    }
    return { best, bestK }
  }

  const segments: RasterSegments = []
  for (const idx of points) {
    if (!mask[idx]) continue
    const x0 = idx % width
    const y0 = (idx - x0) / width
    voted[idx] = 1
    const { best, bestK } = vote(x0, y0, 1)
    if (best < THRESHOLD) continue

    // Walk both ways along the detected direction, tolerating small gaps.
    const dx = -sin[bestK]!
    const dy = cos[bestK]!
    const ends: [number, number][] = []
    for (const dir of [1, -1]) {
      let gap = 0
      let lastX = x0
      let lastY = y0
      for (let s = 1; ; s++) {
        const px = Math.round(x0 + dir * dx * s)
        const py = Math.round(y0 + dir * dy * s)
        if (px < 0 || py < 0 || px >= width || py >= height) break
        if (mask[py * width + px]) {
          gap = 0
          lastX = px
          lastY = py
        } else if (++gap > MAX_GAP) break
      }
      ends.push([lastX, lastY])
    }
    const [[ax, ay], [bx, by]] = ends as [[number, number], [number, number]]
    const len = Math.hypot(bx - ax, by - ay)

    // Remove the stroke's pixels (a narrow corridor, for thick lines) and their votes.
    const steps = Math.max(1, Math.ceil(len))
    const nx = -dy
    const ny = dx
    for (let s = 0; s <= steps; s++) {
      const cx = ax + ((bx - ax) * s) / steps
      const cy = ay + ((by - ay) * s) / steps
      for (let w = -CORRIDOR; w <= CORRIDOR; w += 1) {
        const px = Math.round(cx + nx * w)
        const py = Math.round(cy + ny * w)
        if (px < 0 || py < 0 || px >= width || py >= height) continue
        const j = py * width + px
        if (!mask[j]) continue
        mask[j] = 0
        if (voted[j]) vote(px, py, -1)
      }
    }
    if (len < minLength) continue

    // Least-squares refinement on the original dark pixels of the corridor.
    let sx = 0, sy = 0, m = 0
    const pix: [number, number][] = []
    for (let s = 0; s <= steps; s++) {
      const cx = ax + ((bx - ax) * s) / steps
      const cy = ay + ((by - ay) * s) / steps
      for (let w = -CORRIDOR; w <= CORRIDOR; w += 1) {
        const px = Math.round(cx + nx * w)
        const py = Math.round(cy + ny * w)
        if (px < 0 || py < 0 || px >= width || py >= height || !dark[py * width + px]) continue
        pix.push([px, py])
        sx += px
        sy += py
        m++
      }
    }
    if (m < 3) continue
    // Strokes, not text: most of the length must actually be inked.
    const inked = new Set(pix.map(([px, py]) => Math.round((px - ax) * dx + (py - ay) * dy))).size
    if (inked < (steps + 1) * MIN_DENSITY) continue
    const mx = sx / m
    const my = sy / m
    let sxx = 0, syy = 0, sxy = 0
    for (const [px, py] of pix) {
      sxx += (px - mx) * (px - mx)
      syy += (py - my) * (py - my)
      sxy += (px - mx) * (py - my)
    }
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const ux = Math.cos(theta)
    const uy = Math.sin(theta)
    let tMin = Infinity, tMax = -Infinity
    for (const [px, py] of pix) {
      const t = (px - mx) * ux + (py - my) * uy
      if (t < tMin) tMin = t
      if (t > tMax) tMax = t
    }
    // Pixel centres sit at +0.5; convert to document points.
    const toDoc = (v: number) => (v + 0.5) / scale
    segments.push([toDoc(mx + ux * tMin), toDoc(my + uy * tMin), toDoc(mx + ux * tMax), toDoc(my + uy * tMax)])
  }
  return segments
}

export interface DarkMask {
  dark: Uint8Array
  width: number
  height: number
  scale: number
}

export const darkMask = ({ data, width, height, scale }: RasterInput): DarkMask => {
  const dark = new Uint8Array(width * height)
  for (let i = 0; i < dark.length; i++) {
    const o = i * 4
    if (0.299 * data[o]! + 0.587 * data[o + 1]! + 0.114 * data[o + 2]! < 150) dark[i] = 1
  }
  return { dark, width, height, scale }
}

/**
 * Re-fits a circle (document coordinates) to the inked pixels of its ring:
 * chords cut inside the curve, the pixels themselves do not.
 */
export const refineCircle = (mask: DarkMask, cx: number, cy: number, r: number): [number, number, number] => {
  let c = { x: cx * mask.scale, y: cy * mask.scale }
  let rad = r * mask.scale
  for (let iter = 0; iter < 3; iter++) {
    const band = 2.5
    const pts: [number, number][] = []
    const x0 = Math.max(0, Math.floor(c.x - rad - band))
    const x1 = Math.min(mask.width - 1, Math.ceil(c.x + rad + band))
    const y0 = Math.max(0, Math.floor(c.y - rad - band))
    const y1 = Math.min(mask.height - 1, Math.ceil(c.y + rad + band))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!mask.dark[y * mask.width + x]) continue
        const px = x + 0.5
        const py = y + 0.5
        if (Math.abs(Math.hypot(px - c.x, py - c.y) - rad) <= band) pts.push([px, py])
      }
    }
    if (pts.length < 12) break
    // Kåsa fit, centred for stability.
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
    const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
    let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
    for (const [px, py] of pts) {
      const u = px - mx
      const v = py - my
      suu += u * u; svv += v * v; suv += u * v
      suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u
    }
    const det = suu * svv - suv * suv
    if (Math.abs(det) < 1e-9) break
    const b1 = (suuu + suvv) / 2
    const b2 = (svvv + svuu) / 2
    const uc = (b1 * svv - b2 * suv) / det
    const vc = (b2 * suu - b1 * suv) / det
    c = { x: uc + mx, y: vc + my }
    rad = Math.sqrt(uc * uc + vc * vc + (suu + svv) / pts.length)
  }
  return [c.x / mask.scale, c.y / mask.scale, rad / mask.scale]
}
