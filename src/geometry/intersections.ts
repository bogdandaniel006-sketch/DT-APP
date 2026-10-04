import type { Geometry, Vec } from '../types'
import { angle, angleInArc, type Arc, type Segment } from './primitives'
import { EPS, add, cross, dot, length, scale, sub } from './vec'

const PARAM_TOL = 1e-7

/** Intersection of the infinite lines (a1,b1) and (a2,b2), or null when parallel. */
export const lineLineIntersection = (a1: Vec, b1: Vec, a2: Vec, b2: Vec): { p: Vec; t: number; u: number } | null => {
  const r = sub(b1, a1)
  const s = sub(b2, a2)
  const denom = cross(r, s)
  if (Math.abs(denom) < EPS * Math.max(1, length(r) * length(s))) return null
  const qp = sub(a2, a1)
  const t = cross(qp, s) / denom
  const u = cross(qp, r) / denom
  return { p: add(a1, scale(r, t)), t, u }
}

const inUnit = (t: number) => t >= -PARAM_TOL && t <= 1 + PARAM_TOL

const segmentSegment = (s1: Segment, s2: Segment): Vec[] => {
  const hit = lineLineIntersection(s1.a, s1.b, s2.a, s2.b)
  return hit && inUnit(hit.t) && inUnit(hit.u) ? [hit.p] : []
}

/** Intersections of the segment with the full circle (c, r). */
const segmentCircle = (s: Segment, c: Vec, r: number): Vec[] => {
  const d = sub(s.b, s.a)
  const f = sub(s.a, c)
  const A = dot(d, d)
  if (A < EPS) return []
  const B = 2 * dot(f, d)
  const C = dot(f, f) - r * r
  const disc = B * B - 4 * A * C
  if (disc < -EPS * A) return []
  const sq = Math.sqrt(Math.max(0, disc))
  const ts = disc <= EPS * A ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]
  return ts.filter(inUnit).map((t) => add(s.a, scale(d, t)))
}

const circleCircle = (c1: Vec, r1: number, c2: Vec, r2: number): Vec[] => {
  const d = sub(c2, c1)
  const dist = length(d)
  if (dist < EPS) return []
  if (dist > r1 + r2 + 1e-9 || dist < Math.abs(r1 - r2) - 1e-9) return []
  const a = (r1 * r1 - r2 * r2 + dist * dist) / (2 * dist)
  const h2 = r1 * r1 - a * a
  const base = add(c1, scale(d, a / dist))
  if (h2 <= 1e-12) return [base]
  const h = Math.sqrt(h2)
  const off = { x: (-d.y * h) / dist, y: (d.x * h) / dist }
  return [add(base, off), sub(base, off)]
}

type Round = { c: Vec; r: number; arc?: Arc }

const asRound = (g: Geometry): Round | null => {
  if (g.kind === 'circle') return { c: g.c, r: g.r }
  if (g.kind === 'arc') return { c: g.c, r: g.r, arc: g }
  return null
}

const onRound = (p: Vec, round: Round) => !round.arc || angleInArc(angle(round.c, p), round.arc, 1e-7)

/** All intersection points between two geometries (points are ignored). */
export const intersection = (g1: Geometry, g2: Geometry): Vec[] => {
  if (g1.kind === 'point' || g2.kind === 'point') return []
  if (g1.kind === 'segment' && g2.kind === 'segment') return segmentSegment(g1, g2)
  if (g1.kind === 'segment' || g2.kind === 'segment') {
    const s = (g1.kind === 'segment' ? g1 : g2) as Segment
    const round = asRound(g1.kind === 'segment' ? g2 : g1)
    if (!round) return []
    return segmentCircle(s, round.c, round.r).filter((p) => onRound(p, round))
  }
  const r1 = asRound(g1)
  const r2 = asRound(g2)
  if (!r1 || !r2) return []
  return circleCircle(r1.c, r1.r, r2.c, r2.r).filter((p) => onRound(p, r1) && onRound(p, r2))
}
