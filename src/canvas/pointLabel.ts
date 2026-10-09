import { angle, closestPoint, closestPointOnArc, pointOnCircle, projectionParam } from '../geometry/primitives'
import { mmToPt } from '../geometry/units'
import { add, length, lerp, normAngle, scale, sub } from '../geometry/vec'
import type { Geometry, NameSpot, Vec } from '../types'

/** Height of the letters that name points, as on paper. */
export const NAME_SIZE = mmToPt(2.4)
/** On screen the letters never get smaller than this, so they stay readable zoomed out. */
export const MIN_NAME_PX = 9

/** Average width of a character of the name, as a fraction of the letter size. */
const CHAR_WIDTH = 0.62
/** Height of capitals and digits, as a fraction of the letter size. */
const CAP_HEIGHT = 0.74
/** Clear space between the point and its name, as a fraction of the letter size. */
const GAP = 0.32

/** Where the name may sit around its point, best first: above right as by hand, then the other sides. */
const SIDES: readonly Vec[] = [
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
]

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const inside = (p: Vec, b: Box) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY

/** Whether the segment a→b passes through the box (Liang–Barsky clipping). */
const segmentCrosses = (a: Vec, b: Vec, box: Box) => {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const edges: [number, number][] = [
    [-dx, a.x - box.minX],
    [dx, box.maxX - a.x],
    [-dy, a.y - box.minY],
    [dy, box.maxY - a.y],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

const crosses = (g: Geometry, box: Box) => {
  if (g.kind === 'point') return false
  if (g.kind === 'segment') return segmentCrosses(g.a, g.b, box)
  // Curves: a name is small next to them, so probing from the box's centre, corners and sides is enough.
  const cx = (box.minX + box.maxX) / 2
  const cy = (box.minY + box.maxY) / 2
  const probes: Vec[] = [
    { x: cx, y: cy },
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
    { x: cx, y: box.minY },
    { x: cx, y: box.maxY },
    { x: box.minX, y: cy },
    { x: box.maxX, y: cy },
  ]
  return probes.some((p) => inside(closestPoint(g, p), box))
}

/**
 * Point of a line or a curve its name hangs from: a little past the middle of a segment
 * (the middle itself is where constructions tend to meet), the upper right of a circle,
 * the middle of an arc. The name is then placed around it like the name of a point.
 */
export const nameAnchor = (g: Geometry): Vec => {
  switch (g.kind) {
    case 'segment':
      return { x: g.a.x + (g.b.x - g.a.x) * 0.62, y: g.a.y + (g.b.y - g.a.y) * 0.62 }
    case 'circle':
      return pointOnCircle(g.c, g.r, -Math.PI / 4)
    case 'arc':
      return pointOnCircle(g.c, g.r, g.start + g.sweep / 2)
    case 'point':
      return g.p
  }
}

/** How far from the point its name can reach: strokes beyond this cannot be covered by it. */
export const nameReach = (name: string, size: number) => size * (GAP + CHAR_WIDTH * Math.max(1, name.length) + CAP_HEIGHT)

/**
 * Where to write the name of a point (left end of its baseline) so that it covers as few
 * strokes as possible: the usual place above right when it is free, otherwise the side
 * around the point that crosses the fewest of the given strokes.
 */
export const placeName = (p: Vec, name: string, size: number, strokes: readonly Geometry[]): Vec => {
  const w = size * CHAR_WIDTH * Math.max(1, name.length)
  const h = size * CAP_HEIGHT
  const gap = size * GAP
  let best: Vec | null = null
  let fewest = Infinity
  for (const side of SIDES) {
    const minX = side.x > 0 ? p.x + gap : side.x < 0 ? p.x - gap - w : p.x - w / 2
    const minY = side.y < 0 ? p.y - gap - h : side.y > 0 ? p.y + gap : p.y - h / 2
    const box = { minX, minY, maxX: minX + w, maxY: minY + h }
    let covered = 0
    for (const g of strokes) if (crosses(g, box)) covered++
    if (covered < fewest) {
      fewest = covered
      best = { x: minX, y: minY + h }
      if (covered === 0) break
    }
  }
  return best ?? { x: p.x + gap, y: p.y - gap }
}

/** How far a name moved by hand may sit from its line, curve or point, in letter heights. */
const MAX_SPOT_OFFSET = 2.2

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** Size of the letters of a name: width, and height of capitals. */
export const nameExtent = (name: string, size: number) => ({ w: size * CHAR_WIDTH * Math.max(1, name.length), h: size * CAP_HEIGHT })

/** Point of the geometry a name moved by hand hangs from. */
const spotAnchor = (g: Geometry, t: number): Vec => {
  switch (g.kind) {
    case 'segment':
      return lerp(g.a, g.b, clamp01(t))
    case 'circle':
      return pointOnCircle(g.c, g.r, t)
    case 'arc':
      return pointOnCircle(g.c, g.r, g.start + g.sweep * clamp01(t))
    case 'point':
      return g.p
  }
}

/** The place along the geometry closest to p, as stored in a NameSpot. */
const spotParam = (g: Geometry, p: Vec): number => {
  switch (g.kind) {
    case 'segment':
      return clamp01(projectionParam(p, g.a, g.b))
    case 'circle':
      return angle(g.c, p)
    case 'arc': {
      if (Math.abs(g.sweep) < 1e-9) return 0
      const theta = angle(g.c, closestPointOnArc(p, g))
      const turned = g.sweep >= 0 ? normAngle(theta - g.start) : normAngle(g.start - theta)
      return clamp01(turned / Math.abs(g.sweep))
    }
    case 'point':
      return 0
  }
}

/**
 * Where a name dragged so that its centre is at `centre` ends up: it slides along its line or
 * curve, and never strays further from it than a couple of letter heights.
 */
export const spotFor = (g: Geometry, centre: Vec, size: number): NameSpot => {
  const t = spotParam(g, centre)
  let d = sub(centre, spotAnchor(g, t))
  const max = size * MAX_SPOT_OFFSET
  if (length(d) > max) d = scale(d, max / length(d))
  return { t, dx: d.x, dy: d.y }
}

/**
 * Where to write the name of a point, a line or a curve (left end of its baseline): where it was
 * moved by hand, or else around its anchor where it covers the fewest strokes.
 */
export const nameBaseline = (
  g: Geometry & { nameSpot?: NameSpot },
  name: string,
  size: number,
  strokesNear: (anchor: Vec) => readonly Geometry[],
): Vec => {
  if (g.nameSpot) {
    const centre = add(spotAnchor(g, g.nameSpot.t), { x: g.nameSpot.dx, y: g.nameSpot.dy })
    const { w, h } = nameExtent(name, size)
    return { x: centre.x - w / 2, y: centre.y + h / 2 }
  }
  const anchor = nameAnchor(g)
  return placeName(anchor, name, size, strokesNear(anchor))
}
