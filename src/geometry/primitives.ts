import type { Geometry, Vec } from '../types'
import { EPS, TAU, add, dot, fromAngle, length, lerp, normAngle, perp, scale, sub } from './vec'

export type Segment = Extract<Geometry, { kind: 'segment' }>
export type Circle = Extract<Geometry, { kind: 'circle' }>
export type Arc = Extract<Geometry, { kind: 'arc' }>
export type PointGeom = Extract<Geometry, { kind: 'point' }>

export const segment = (a: Vec, b: Vec): Segment => ({ kind: 'segment', a, b })

export const distance = (a: Vec, b: Vec): number => Math.hypot(b.x - a.x, b.y - a.y)

/** Direction angle of a→b in world (screen) frame, in radians. */
export const angle = (a: Vec, b: Vec): number => Math.atan2(b.y - a.y, b.x - a.x)

export const midpoint = (a: Vec, b: Vec): Vec => lerp(a, b, 0.5)

/** Parameter t of the orthogonal projection of p onto the infinite line ab. */
export const projectionParam = (p: Vec, a: Vec, b: Vec): number => {
  const ab = sub(b, a)
  const l2 = dot(ab, ab)
  return l2 < EPS ? 0 : dot(sub(p, a), ab) / l2
}

/** Orthogonal projection of p onto the infinite line through a and b. */
export const projectPointOnLine = (p: Vec, a: Vec, b: Vec): Vec => lerp(a, b, projectionParam(p, a, b))

export const closestPointOnSegment = (p: Vec, a: Vec, b: Vec): Vec =>
  lerp(a, b, Math.min(1, Math.max(0, projectionParam(p, a, b))))

export const distanceToSegment = (p: Vec, a: Vec, b: Vec): number => distance(p, closestPointOnSegment(p, a, b))

/**
 * Perpendicular from p to the line of `base`: the segment from p to its foot.
 * When p lies on the line the result is degenerate (a === b).
 */
export const perpendicular = (base: Segment, p: Vec): Segment => segment(p, projectPointOnLine(p, base.a, base.b))

/** Unit normal to a segment. */
export const normalOf = (s: Segment): Vec => {
  const d = sub(s.b, s.a)
  const l = length(d)
  return l < EPS ? { x: 0, y: -1 } : perp(scale(d, 1 / l))
}

/**
 * Parallel to `base` through p: the same segment translated so that it passes
 * through p, keeping length and angle exactly.
 */
export const parallel = (base: Segment, p: Vec): Segment => {
  const offset = sub(p, projectPointOnLine(p, base.a, base.b))
  return segment(add(base.a, offset), add(base.b, offset))
}

export const circleFromCenterRadius = (c: Vec, r: number): Circle => ({ kind: 'circle', c, r: Math.abs(r) })

/**
 * Arc centred on `c`, starting at the direction of `from` and sweeping `sweep`
 * radians (positive = clockwise on screen). The radius is |c→from|.
 */
export const arcFromPoints = (c: Vec, from: Vec, sweep: number, radius = distance(c, from)): Arc => ({
  kind: 'arc',
  c,
  r: radius,
  start: angle(c, from),
  sweep: Math.max(-TAU, Math.min(TAU, sweep)),
})

export const pointOnCircle = (c: Vec, r: number, theta: number): Vec => add(c, fromAngle(theta, r))

export const arcStartPoint = (a: Arc): Vec => pointOnCircle(a.c, a.r, a.start)
export const arcEndPoint = (a: Arc): Vec => pointOnCircle(a.c, a.r, a.start + a.sweep)

/** Whether direction `theta` lies within the angular range covered by the arc. */
export const angleInArc = (theta: number, a: Arc, tol = 1e-9): boolean => {
  const t = a.sweep >= 0 ? normAngle(theta - a.start) : normAngle(a.start - theta)
  const span = Math.abs(a.sweep)
  return t <= span + tol || t >= TAU - tol
}

export const closestPointOnCircle = (p: Vec, c: Vec, r: number): Vec => {
  const d = sub(p, c)
  const l = length(d)
  return l < EPS ? add(c, { x: r, y: 0 }) : add(c, scale(d, r / l))
}

export const closestPointOnArc = (p: Vec, a: Arc): Vec => {
  const onCircle = closestPointOnCircle(p, a.c, a.r)
  if (angleInArc(angle(a.c, onCircle), a)) return onCircle
  const s = arcStartPoint(a)
  const e = arcEndPoint(a)
  return distance(p, s) <= distance(p, e) ? s : e
}

/** Closest point of a geometry to p. */
export const closestPoint = (g: Geometry, p: Vec): Vec => {
  switch (g.kind) {
    case 'segment':
      return closestPointOnSegment(p, g.a, g.b)
    case 'circle':
      return closestPointOnCircle(p, g.c, g.r)
    case 'arc':
      return closestPointOnArc(p, g)
    case 'point':
      return g.p
  }
}

export const distanceToGeometry = (g: Geometry, p: Vec): number => distance(p, closestPoint(g, p))
