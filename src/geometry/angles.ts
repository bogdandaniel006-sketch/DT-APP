import type { Vec } from '../types'
import { lineLineIntersection } from './intersections'
import { angle, distance, type Segment } from './primitives'
import { add, dot, fromAngle, normalize, scale, sub, toRad, wrapAngle } from './vec'

/**
 * Angle swept from the right-pointing horizontal ray to the ray a→b, in [0, π].
 * Up-right 30° and down-right 30° both read 30°: the arc drawn shows the side.
 */
export const horizontalAngle = (a: Vec, b: Vec): number => Math.abs(angle(a, b))

export interface AngleMark {
  vertex: Vec
  /** Start direction (screen radians) and signed sweep of the arc to draw. */
  from: number
  sweep: number
  value: number
  right: boolean
}

const RIGHT_TOL = toRad(0.05)

export const angleMark = (vertex: Vec, from: number, to: number): AngleMark => {
  const sweep = wrapAngle(to - from)
  const value = Math.abs(sweep)
  return { vertex, from, sweep, value, right: Math.abs(value - Math.PI / 2) < RIGHT_TOL }
}

/** Arc between the horizontal and the segment, anchored at its start (always drawn as an arc). */
export const horizontalMark = (a: Vec, b: Vec): AngleMark => ({ ...angleMark(a, 0, angle(a, b)), right: false })

export interface DirectionConstraint {
  p: Vec
  /** Direction the point was snapped to, if any. */
  snapped: number | null
}

const COMMON_ANGLES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)

/**
 * Soft angle snapping for a line from `start` towards `cursor`.
 * - `lockStep` (Shift): forces multiples of that step.
 * - otherwise, gently snaps to 0°, 45°, 90°… and to `extra` directions (instrument edges).
 */
export const constrainDirection = (
  start: Vec,
  cursor: Vec,
  options: { lockStep?: number; extra?: readonly number[]; tolerance?: number } = {},
): DirectionConstraint => {
  const len = distance(start, cursor)
  if (len < 1e-9) return { p: cursor, snapped: null }
  const theta = angle(start, cursor)
  const project = (dir: number): Vec => add(start, fromAngle(dir, len * Math.cos(theta - dir)))

  if (options.lockStep) {
    const dir = Math.round(theta / options.lockStep) * options.lockStep
    return { p: project(dir), snapped: dir }
  }

  const tol = options.tolerance ?? toRad(2.5)
  const candidates = [...COMMON_ANGLES, ...(options.extra ?? []).flatMap((a) => [a, a + Math.PI])]
  let best: number | null = null
  let bestDiff = tol
  for (const c of candidates) {
    const diff = Math.abs(wrapAngle(theta - c))
    if (diff <= bestDiff) {
      best = c
      bestDiff = diff
    }
  }
  return best === null ? { p: cursor, snapped: null } : { p: project(best), snapped: best }
}

export interface NeighbourAngle {
  mark: AngleMark
  /** Dashed continuations when the lines only meet past their ends. */
  extensions: [Vec, Vec][]
}

/**
 * Angles formed by `seg` with the lines it meets — crossing, touching, or
 * meeting within `reach` past their ends. Always the non-obtuse angle between
 * both lines, nearest first.
 */
export const angleWithNeighbours = (
  seg: Segment,
  others: readonly Segment[],
  tol: number,
  max = 2,
  reach = 0,
): NeighbourAngle[] => {
  const len = distance(seg.a, seg.b)
  if (len < 1e-6) return []
  const found: (NeighbourAngle & { d: number })[] = []
  for (const o of others) {
    const olen = distance(o.a, o.b)
    if (olen < 1e-6) continue
    const hit = lineLineIntersection(seg.a, seg.b, o.a, o.b)
    if (!hit) continue
    const et = (tol + reach) / len
    const eu = (tol + reach) / olen
    if (hit.t < -et || hit.t > 1 + et || hit.u < -eu || hit.u > 1 + eu) continue
    const x = hit.p
    const farOf = (s: Segment) => (distance(x, s.a) > distance(x, s.b) ? s.a : s.b)
    const d1 = normalize(sub(farOf(seg), x))
    let d2 = normalize(sub(farOf(o), x))
    if (dot(d1, d2) < 0) d2 = scale(d2, -1)
    const mark = angleMark(x, Math.atan2(d1.y, d1.x), Math.atan2(d2.y, d2.x))
    if (mark.value < toRad(0.5)) continue
    const extensions: [Vec, Vec][] = []
    const extend = (s: Segment, t: number) => {
      if (t < -tol / distance(s.a, s.b)) extensions.push([s.a, x])
      else if (t > 1 + tol / distance(s.a, s.b)) extensions.push([s.b, x])
    }
    extend(seg, hit.t)
    extend(o, hit.u)
    found.push({ mark, extensions, d: Math.min(distance(x, seg.a), distance(x, seg.b)) })
  }
  return found
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ mark, extensions }) => ({ mark, extensions }))
}

/** Angle ABC at vertex B, in [0, π]. Exact: computed from the vectors, not from rounded directions. */
export const vertexAngle = (a: Vec, b: Vec, c: Vec): number => {
  const u = sub(a, b)
  const v = sub(c, b)
  return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), dot(u, v))
}
