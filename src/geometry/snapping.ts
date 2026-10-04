import type { Geometry, SnapMode, Vec } from '../types'
import { intersection } from './intersections'
import { closestPoint, distance, midpoint, segment, type Segment } from './primitives'
import { keyPoints, type KeyPointKind } from './shapes'
import { add, dot, scale, sub } from './vec'

export type SnapKind = KeyPointKind | 'intersection' | 'vertex' | 'on-line' | 'on-circle' | 'edge'

/** Where the snapped geometry comes from. */
export type SnapSource = 'pdf' | 'drawing' | 'instrument'

export interface SnapResult {
  p: Vec
  kind: SnapKind | null
  source?: SnapSource
  /** Name of the point snapped to (A, O', P1…). */
  name?: string
}

export interface SnapPoint {
  p: Vec
  kind: SnapKind
  source: SnapSource
  name?: string
}

export interface SnapCurve {
  geom: Geometry
  source: SnapSource
}

export interface SnapTargets {
  /** Drawn geometry; points may carry a name. */
  geoms: readonly (Geometry & { name?: string })[]
  /** Edges of the visible drawing instruments. */
  edges: readonly Segment[]
  /** Geometry detected in the PDF near the cursor. */
  pdf?: { points: readonly SnapPoint[]; curves: readonly Geometry[] }
}

export const SNAP_LABELS: Record<SnapKind, string> = {
  endpoint: 'Extremo',
  midpoint: 'Punto medio',
  center: 'Centro',
  point: 'Punto',
  intersection: 'Intersección',
  vertex: 'Vértice',
  'on-line': 'Sobre línea',
  'on-circle': 'Sobre curva',
  edge: 'Borde',
}

/** Screen tolerance (px) of each mode. Libre never snaps. */
export const SNAP_RADIUS_PX: Record<SnapMode, number> = { preciso: 16, normal: 10, libre: 0 }

/** Priority order: point, intersection, endpoint, centre, midpoint; then lines and circles. */
const RANK: Partial<Record<SnapKind, number>> = {
  point: 0,
  intersection: 1,
  endpoint: 2,
  vertex: 2,
  center: 3,
  midpoint: 4,
}

/**
 * How much priority weighs against distance, as a fraction of the tolerance per rank.
 * Precise mode lets a point or intersection win even when something else is a bit closer.
 */
const RANK_WEIGHT: Record<SnapMode, number> = { preciso: 0.3, normal: 0.12, libre: 0 }

const best = <T extends { p: Vec }>(p: Vec, candidates: Iterable<T>, tol: number, penalty: (c: T) => number): T | null => {
  let found: T | null = null
  let bestScore = Infinity
  for (const c of candidates) {
    const d = distance(p, c.p)
    if (d > tol) continue
    const score = d + penalty(c)
    if (score < bestScore) {
      found = c
      bestScore = score
    }
  }
  return found
}

/** Nearest explicit point (point, endpoint, centre…) within tolerance, honouring priorities. */
export const snapToPoint = (p: Vec, points: Iterable<SnapPoint>, tol: number, mode: SnapMode = 'normal'): SnapResult | null => {
  const hit = best(p, points, tol, (c) => (RANK[c.kind] ?? 5) * RANK_WEIGHT[mode] * tol)
  return hit ? { p: hit.p, kind: hit.kind, source: hit.source, name: hit.name } : null
}

export const snapToMidpoint = (p: Vec, segments: readonly Segment[], tol: number): SnapResult | null =>
  snapToPoint(
    p,
    segments.map((s) => ({ p: midpoint(s.a, s.b), kind: 'midpoint' as const, source: 'drawing' as const })),
    tol,
  )

/**
 * Intersections near p. Only curves passing within `tol` of p can intersect
 * near p, so pairs are tested among those alone — fast at any document size.
 */
export const intersectionsNear = (p: Vec, curves: readonly SnapCurve[], tol: number): SnapPoint[] => {
  const near = curves.filter((c) => c.geom.kind !== 'point' && distance(p, closestPoint(c.geom, p)) <= tol)
  const found: SnapPoint[] = []
  for (let i = 0; i < near.length; i++) {
    for (let j = i + 1; j < near.length; j++) {
      const a = near[i]!
      const b = near[j]!
      const source: SnapSource = a.source === 'pdf' && b.source === 'pdf' ? 'pdf' : a.source === 'instrument' || b.source === 'instrument' ? 'instrument' : 'drawing'
      for (const q of intersection(a.geom, b.geom)) found.push({ p: q, kind: 'intersection', source })
    }
  }
  return found
}

export const snapToIntersection = (p: Vec, geoms: readonly Geometry[], tol: number): SnapResult | null => {
  const hit = best(p, intersectionsNear(p, geoms.map((geom) => ({ geom, source: 'drawing' as const })), tol), tol, () => 0)
  return hit ? { p: hit.p, kind: 'intersection', source: hit.source } : null
}

const curveKind = (g: Geometry): SnapKind => (g.kind === 'segment' ? 'on-line' : 'on-circle')

/** Every explicit point of the targets: key points of the drawing, instrument vertices and PDF points. */
const targetPoints = (targets: SnapTargets): SnapPoint[] => {
  const points: SnapPoint[] = []
  for (const g of targets.geoms) {
    for (const k of keyPoints(g)) {
      points.push({ ...k, source: 'drawing', name: g.kind === 'point' ? g.name : undefined })
    }
  }
  for (const e of targets.edges) points.push({ p: e.a, kind: 'vertex', source: 'instrument' })
  if (targets.pdf) points.push(...targets.pdf.points)
  return points
}

const targetCurves = (targets: SnapTargets): SnapCurve[] => [
  ...targets.geoms.filter((g) => g.kind !== 'point').map((geom) => ({ geom, source: 'drawing' as const })),
  ...targets.edges.map((geom) => ({ geom, source: 'instrument' as const })),
  ...(targets.pdf?.curves ?? []).map((geom) => ({ geom, source: 'pdf' as const })),
]

/** Full snap: explicit points and intersections by priority, then the nearest stroke. */
export const snap = (p: Vec, targets: SnapTargets, tol: number, mode: SnapMode = 'normal'): SnapResult => {
  if (mode === 'libre' || tol <= 0) return { p, kind: null }

  const points = targetPoints(targets)
  const curves = targetCurves(targets)
  points.push(...intersectionsNear(p, curves, tol))

  const hit = snapToPoint(p, points, tol, mode)
  if (hit) return hit

  // Lines before circles, as in the priority order.
  let found: SnapResult | null = null
  let bestScore = Infinity
  for (const c of curves) {
    const q = closestPoint(c.geom, p)
    const d = distance(p, q)
    if (d > tol) continue
    const score = d + (c.geom.kind === 'segment' ? 0 : RANK_WEIGHT[mode] * tol)
    if (score < bestScore) {
      found = { p: q, kind: c.source === 'instrument' ? 'edge' : curveKind(c.geom), source: c.source }
      bestScore = score
    }
  }
  return found ?? { p, kind: null }
}

/** How far off the line (as a fraction of the tolerance) a point may lie and still be snapped to. */
const ON_LINE_FRACTION = 0.25

/**
 * Snap that never leaves a line: `p` lies on it and `dir` is its unit direction.
 * It stops where the line cuts a nearby stroke and at points lying on the line.
 */
export const snapAlongLine = (p: Vec, dir: Vec, targets: SnapTargets, tol: number, mode: SnapMode = 'normal'): SnapResult => {
  if (mode === 'libre' || tol <= 0) return { p, kind: null }

  const points: SnapPoint[] = []
  for (const k of targetPoints(targets)) {
    const q = add(p, scale(dir, dot(sub(k.p, p), dir)))
    if (distance(k.p, q) <= tol * ON_LINE_FRACTION) points.push({ ...k, p: q })
  }
  const probe = segment(sub(p, scale(dir, tol)), add(p, scale(dir, tol)))
  for (const c of targetCurves(targets)) {
    for (const q of intersection(probe, c.geom)) points.push({ p: q, kind: 'intersection', source: c.source })
  }
  return snapToPoint(p, points, tol, mode) ?? { p, kind: null }
}

/** Short description for the indicator next to the cursor: "A", "Intersección · PDF"… */
export const snapLabel = (s: SnapResult): string | null => {
  if (!s.kind) return null
  if (s.name) return s.name
  return s.source === 'pdf' ? `${SNAP_LABELS[s.kind]} · PDF` : SNAP_LABELS[s.kind]
}
