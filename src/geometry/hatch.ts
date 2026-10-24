import type { Geometry, Vec } from '../types'
import { intersection } from './intersections'
import { distanceToGeometry, segment } from './primitives'
import { mmToPt } from './units'
import { add, dot, scale, toRad } from './vec'

/**
 * Section lining (rayado de cortes y secciones, UNE-EN ISO 128-50): thin continuous lines,
 * usually at 45°, evenly spaced, filling the cut area. The area is the closed region around a
 * point, found as a paint bucket finds it: the outlines (drawn, and the ink of the PDF) are
 * painted on a grid, slightly thickened so that small gaps close, and the region is flooded
 * from the point. Each line of the lining is then cut where it leaves the region, and its ends
 * are put exactly on the outline when a drawn or detected stroke is there.
 */

/** Usual spacing of the lining, in millimetres on paper. */
export const HATCH_SPACING = 2
export const HATCH_ANGLES = [45, 135] as const
/** Longest stretch of outline a line is followed through to find where it really ends (desk units, about 25 mm). */
const MAX_WALL = mmToPt(25)

/** A grid over a page: 1 where there is an outline, 0 where there is paper. */
export interface Walls {
  data: Uint8Array
  w: number
  h: number
  /** Desk position of the corner of cell (0, 0). */
  origin: Vec
  /** Cells per desk unit. */
  res: number
  /** How far (desk units) the outlines were thickened: the region stops this short of them. */
  grow: number
}

export interface Region {
  /** 1 for every cell of the region. */
  inside: Uint8Array
  /** The region runs out of the page: the outline around the point is not closed. */
  open: boolean
  /** Bounding box, in cells. */
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Thickens the outlines by `r` cells in every direction (a square brush: cheap and enough). */
export const thicken = (data: Uint8Array, w: number, h: number, r: number) => {
  if (r <= 0) return data
  const across = new Uint8Array(data.length)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (!data[row + x]) continue
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) across[row + k] = 1
    }
  }
  const out = new Uint8Array(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!across[y * w + x]) continue
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) out[k * w + x] = 1
    }
  }
  return out
}

/** The region of paper around the desk point `p` (scanline flood fill), or null on an outline or off the page. */
export const regionAt = (walls: Walls, p: Vec): Region | null => {
  const { data, w, h, origin, res } = walls
  const sx = Math.floor((p.x - origin.x) * res)
  const sy = Math.floor((p.y - origin.y) * res)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || data[sy * w + sx]) return null
  const inside = new Uint8Array(w * h)
  const stack = [sx, sy]
  let open = false
  let minX = sx
  let maxX = sx
  let minY = sy
  let maxY = sy
  const free = (x: number, y: number) => !data[y * w + x] && !inside[y * w + x]
  while (stack.length) {
    const y = stack.pop()!
    let x = stack.pop()!
    if (!free(x, y)) continue
    while (x > 0 && free(x - 1, y)) x--
    let upOpen = false
    let downOpen = false
    for (; x < w && free(x, y); x++) {
      inside[y * w + x] = 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) open = true
      if (y > 0) {
        const f = free(x, y - 1)
        if (f && !upOpen) stack.push(x, y - 1)
        upOpen = f
      }
      if (y < h - 1) {
        const f = free(x, y + 1)
        if (f && !downOpen) stack.push(x, y + 1)
        downOpen = f
      }
    }
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { inside, open, minX, minY, maxX, maxY }
}

/** Whether a desk point lies in the region. */
export const inRegion = (walls: Walls, region: Region, p: Vec) => {
  const x = Math.floor((p.x - walls.origin.x) * walls.res)
  const y = Math.floor((p.y - walls.origin.y) * walls.res)
  return x >= 0 && y >= 0 && x < walls.w && y < walls.h && region.inside[y * walls.w + x] === 1
}

/** Direction of the lines on the desk (y grows downwards, so 45° on paper goes up and right). */
const directionOf = (angle: number): Vec => ({ x: Math.cos(toRad(angle)), y: -Math.sin(toRad(angle)) })

/**
 * The lines of the lining over the region: `angle` in degrees on paper, `spacing` in
 * millimetres. Lines sit at whole multiples of the spacing from the desk's origin, so two areas
 * lined alike side by side read as one. `outlines` are the strokes the ends are fitted to.
 */
export const hatchLines = (walls: Walls, region: Region, angle: number, spacing: number, outlines: readonly Geometry[]): [Vec, Vec][] => {
  const { origin, res, grow } = walls
  const u = directionOf(angle)
  const n = { x: -u.y, y: u.x }
  const gap = mmToPt(spacing)
  const corners = [
    { x: region.minX, y: region.minY },
    { x: region.maxX + 1, y: region.minY },
    { x: region.minX, y: region.maxY + 1 },
    { x: region.maxX + 1, y: region.maxY + 1 },
  ].map((c) => add(origin, scale(c, 1 / res)))
  const across = corners.map((c) => dot(c, n))
  const along = corners.map((c) => dot(c, u))
  const tMin = Math.min(...along) - 1
  const tMax = Math.max(...along) + 1
  const step = 0.5 / res
  /** Whether a desk point is on an outline of the grid (or off it). */
  const isWall = (p: Vec) => {
    const x = Math.floor((p.x - origin.x) * res)
    const y = Math.floor((p.y - origin.y) * res)
    return x < 0 || y < 0 || x >= walls.w || y >= walls.h || walls.data[y * walls.w + x] === 1
  }
  /** How far the end of a line may move to meet the real outline. */
  const reach = grow + 2 / res
  const out: [Vec, Vec][] = []

  for (let k = Math.ceil(Math.min(...across) / gap); k * gap <= Math.max(...across); k++) {
    const base = scale(n, k * gap)
    const at = (t: number) => add(base, scale(u, t))
    // Where this line crosses the outlines, as distances along it.
    const line = segment(at(tMin - reach), at(tMax + reach))
    const crossings: number[] = []
    for (const g of outlines) for (const p of intersection(line, g)) crossings.push(dot(p, u))
    /**
     * The end of a run moved onto the outline: the first crossing beyond it, up to `limit` (where
     * the next run starts; a line grazing a curve meets it well past where the thickening stopped
     * it). Without one, out to where the thickened outline began.
     */
    const fit = (t: number, outwards: number, limit: number) => {
      let best: number | null = null
      for (const c of crossings) {
        const d = (c - t) * outwards
        if (d >= -1 / res && d <= limit && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c
      }
      return best ?? t + outwards * grow
    }
    // Stretches of the line inside the region.
    const runs: [number, number][] = []
    let start: number | null = null
    for (let t = tMin; t <= tMax + step; t += step) {
      const inside = t <= tMax && inRegion(walls, region, at(t))
      if (inside && start === null) start = t
      if (!inside && start !== null) {
        runs.push([start, t - step])
        start = null
      }
    }
    // A break that only comes from the thickening around an outline the line does not cross
    // (it passes close by, as near the top of a circle) is not a real one: the line goes on.
    const merged: [number, number][] = []
    for (const run of runs) {
      const prev = merged.at(-1)
      if (prev && !crossings.some((c) => c > prev[1] - reach && c < run[0] + reach) && onlyHalo(prev[1], run[0])) prev[1] = run[1]
      else merged.push([...run])
    }
    /**
     * How far the line runs through outline (thickened) from t, in that direction. A line nearly
     * parallel to an edge crosses its thickening slantwise, over several millimetres, and only
     * meets the edge itself at the far end: its end is looked for all along that stretch.
     */
    const throughWall = (t: number, outwards: number) => {
      let d = 0
      while (d < MAX_WALL && isWall(at(t + outwards * (d + step)))) d += step
      return d + reach
    }
    merged.forEach(([s, e], i) => {
      const a = fit(s, -1, i > 0 ? s - merged[i - 1]![1] : throughWall(s, -1))
      const b = fit(e, 1, i < merged.length - 1 ? merged[i + 1]![0] - e : throughWall(e, 1))
      if (b - a > 1 / res) out.push([at(a), at(b)])
    })

    /** Whether the stretch between two runs is all close to some outline (its thickened halo), not ink of its own. */
    function onlyHalo(from: number, to: number) {
      for (let t = from + step; t < to; t += step * 2) {
        const p = at(t)
        if (!outlines.some((g) => distanceToGeometry(g, p) <= reach)) return false
      }
      return true
    }
  }
  return out
}
