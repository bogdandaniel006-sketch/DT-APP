import type { Drawable, Geometry, Measure, Shape, Vec } from '../types'
import { formatAngle, formatPrecise } from '../utils/format'
import { horizontalAngle, vertexAngle } from './angles'
import { arcEndPoint, arcStartPoint, distanceToGeometry, midpoint, distance, segment } from './primitives'
import { add } from './vec'

export type KeyPointKind = 'endpoint' | 'midpoint' | 'center' | 'point'

export interface KeyPoint {
  p: Vec
  kind: KeyPointKind
}

export const keyPoints = (g: Geometry): KeyPoint[] => {
  switch (g.kind) {
    case 'segment':
      return [
        { p: g.a, kind: 'endpoint' },
        { p: g.b, kind: 'endpoint' },
        { p: midpoint(g.a, g.b), kind: 'midpoint' },
      ]
    case 'circle':
      return [{ p: g.c, kind: 'center' }]
    case 'arc':
      return [
        { p: arcStartPoint(g), kind: 'endpoint' },
        { p: arcEndPoint(g), kind: 'endpoint' },
        { p: g.c, kind: 'center' },
      ]
    case 'point':
      return [{ p: g.p, kind: 'point' }]
  }
}

export const translateGeometry = <G extends Drawable>(g: G, d: Vec): G => {
  switch (g.kind) {
    case 'segment':
    case 'distance':
      return { ...g, a: add(g.a, d), b: add(g.b, d) }
    case 'angle':
      return { ...g, a: add(g.a, d), b: add(g.b, d), c: add(g.c, d) }
    case 'circle':
    case 'arc':
      return { ...g, c: add(g.c, d) }
    case 'point':
      return { ...g, p: add(g.p, d) }
  }
  return g
}

/** The point that decides which sheet a construction belongs to. */
export const anchorOf = (g: Drawable): Vec => {
  switch (g.kind) {
    case 'segment':
    case 'distance':
      return g.a
    case 'angle':
      return g.b
    case 'circle':
    case 'arc':
      return g.c
    case 'point':
      return g.p
  }
}

/** Strokes a measurement is drawn with: used to hit-test and highlight it. */
export const measureOutline = (m: Measure): Geometry[] =>
  m.kind === 'distance' ? [segment(m.a, m.b)] : [segment(m.b, m.a), segment(m.b, m.c)]

export const outlineOf = (d: Drawable): Geometry[] =>
  d.kind === 'distance' || d.kind === 'angle' ? measureOutline(d) : [d]

export const distanceToDrawable = (d: Drawable, p: Vec): number =>
  Math.min(...outlineOf(d).map((g) => distanceToGeometry(g, p)))

/** Topmost shape within `tol` of p, preferring points and the closest stroke. */
export const hitTest = (shapes: readonly Shape[], p: Vec, tol: number, filter?: (s: Shape) => boolean): Shape | null => {
  let best: Shape | null = null
  let bestScore = Infinity
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]!
    if (filter && !filter(s)) continue
    const d = distanceToDrawable(s, p)
    if (d > tol) continue
    // Points are tiny; give them priority over strokes passing nearby.
    const score = s.kind === 'point' ? d - tol : d
    if (score < bestScore) {
      best = s
      bestScore = score
    }
  }
  return best
}

export const shapeName = (g: Drawable): string =>
  ({
    segment: 'Segmento',
    circle: 'Circunferencia',
    arc: 'Arco',
    point: 'Punto',
    distance: 'Distancia',
    angle: 'Ángulo',
  })[g.kind]

/** Measurements shown when a shape is selected. */
export const measurements = (g: Drawable): string[] => {
  switch (g.kind) {
    case 'segment':
      return [`Longitud ${formatPrecise(distance(g.a, g.b))}`, `Ángulo ${formatAngle(horizontalAngle(g.a, g.b))}`]
    case 'circle':
      return [`Radio ${formatPrecise(g.r)}`, `Diámetro ${formatPrecise(g.r * 2)}`]
    case 'arc':
      return [`Radio ${formatPrecise(g.r)}`, `Ángulo ${formatAngle(g.sweep)}`]
    case 'distance':
      return [formatPrecise(distance(g.a, g.b))]
    case 'angle':
      return [formatAngle(vertexAngle(g.a, g.b, g.c))]
    case 'point':
      return []
  }
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const boundsOfPoints = (pts: readonly Vec[]): Bounds => ({
  minX: Math.min(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)),
  maxX: Math.max(...pts.map((p) => p.x)),
  maxY: Math.max(...pts.map((p) => p.y)),
})

export const bounds = (g: Drawable): Bounds => {
  switch (g.kind) {
    case 'segment':
    case 'distance':
      return boundsOfPoints([g.a, g.b])
    case 'angle':
      return boundsOfPoints([g.a, g.b, g.c])
    case 'circle':
    case 'arc':
      return { minX: g.c.x - g.r, minY: g.c.y - g.r, maxX: g.c.x + g.r, maxY: g.c.y + g.r }
    case 'point':
      return boundsOfPoints([g.p])
  }
}

export const boundsInside = (inner: Bounds, outer: Bounds): boolean =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minY >= outer.minY && inner.maxY <= outer.maxY
