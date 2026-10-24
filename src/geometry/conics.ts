import type { Conic, ConicType, Vec } from '../types'
import { closestPointOnSegment, distance, segment, type Segment } from './primitives'
import { add, dot, fromAngle, length, normalize, sub } from './vec'

/**
 * Conics as constructed in technical drawing:
 *
 * - ellipse, by its axes: the ends A and B of the major axis and one end C of the minor
 *   (the centre is the middle of AB, the other end D is symmetric to C);
 * - hyperbola, by its real axis and a focus: the vertices A and A' and a focus F;
 * - parabola, by its directrix and focus.
 *
 * Each is kept by its elements (centre or vertex, axes, direction) and drawn as a fine polyline.
 */

const ELLIPSE_STEPS = 360
const BRANCH_STEPS = 160

/** A point given in the conic's own axes (x along the main axis), on the desk. */
const place = (c: Vec, rot: number, x: number, y: number): Vec => {
  const u = fromAngle(rot)
  return { x: c.x + u.x * x - u.y * y, y: c.y + u.y * x + u.x * y }
}

/** The curve of a conic of these elements, as polylines (two branches for a hyperbola). */
export const conicPaths = (type: ConicType, c: Vec, rot: number, a: number, b: number, reach: number): Vec[][] => {
  if (type === 'ellipse') {
    return [Array.from({ length: ELLIPSE_STEPS + 1 }, (_, i) => {
      const t = (i / ELLIPSE_STEPS) * Math.PI * 2
      return place(c, rot, a * Math.cos(t), b * Math.sin(t))
    })]
  }
  if (type === 'hyperbola') {
    const top = Math.asinh(reach / b)
    const branch = (side: number) =>
      Array.from({ length: BRANCH_STEPS + 1 }, (_, i) => {
        const t = -top + (2 * top * i) / BRANCH_STEPS
        return place(c, rot, side * a * Math.cosh(t), b * Math.sinh(t))
      })
    return [branch(1), branch(-1)]
  }
  // Parabola y² = 4·a·x from its vertex, the focus at x = a.
  return [Array.from({ length: BRANCH_STEPS + 1 }, (_, i) => {
    const y = -reach + (2 * reach * i) / BRANCH_STEPS
    return place(c, rot, (y * y) / (4 * a), y)
  })]
}

const make = (type: ConicType, c: Vec, rot: number, a: number, b: number, reach: number): Conic => ({
  kind: 'conic',
  type,
  c,
  rot,
  a,
  b,
  reach,
  paths: conicPaths(type, c, rot, a, b, reach),
})

/** Distance from p to the line through `o` with direction `u` (unit), signed. */
const across = (p: Vec, o: Vec, u: Vec) => dot(sub(p, o), { x: -u.y, y: u.x })

/** Ellipse from the ends of its major axis and one end of its minor axis (its distance to the major axis). */
export const ellipseFromAxes = (A: Vec, B: Vec, C: Vec): Conic | null => {
  const c = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }
  const a = distance(A, B) / 2
  const u = normalize(sub(B, A))
  const b = Math.abs(across(C, c, u))
  if (a < 1e-6 || b < 1e-6) return null
  const rot = Math.atan2(u.y, u.x)
  // The shorter axis given first: they are simply the other way round.
  return b > a ? make('ellipse', c, rot + Math.PI / 2, b, a, 0) : make('ellipse', c, rot, a, b, 0)
}

/** Hyperbola from its vertices and a focus (only its distance from the centre matters), its branches reaching `reach` either side. */
export const hyperbolaFromVertices = (A: Vec, A2: Vec, F: Vec, reach: number): Conic | null => {
  const c = { x: (A.x + A2.x) / 2, y: (A.y + A2.y) / 2 }
  const a = distance(A, A2) / 2
  const u = normalize(sub(A2, A))
  const focal = Math.abs(dot(sub(F, c), u))
  // The foci lie beyond the vertices: c > a.
  if (a < 1e-6 || focal <= a * 1.0001 || reach < 1e-6) return null
  return make('hyperbola', c, Math.atan2(u.y, u.x), a, Math.sqrt(focal * focal - a * a), reach)
}

/** Parabola from its directrix (any two points of it) and focus, reaching `reach` either side of its axis. */
export const parabolaFromDirectrix = (d: Segment, F: Vec, reach: number): Conic | null => {
  const along = normalize(sub(d.b, d.a))
  const foot = add(d.a, { x: along.x * dot(sub(F, d.a), along), y: along.y * dot(sub(F, d.a), along) })
  const toFocus = sub(F, foot)
  const p = length(toFocus)
  if (p < 1e-6 || reach < 1e-6) return null
  const vertex = { x: (F.x + foot.x) / 2, y: (F.y + foot.y) / 2 }
  return make('parabola', vertex, Math.atan2(toFocus.y, toFocus.x), p / 2, 0, reach)
}

/** The same conic with its curve drawn again (after its elements changed). */
export const redrawConic = (g: Conic): Conic => ({ ...g, paths: conicPaths(g.type, g.c, g.rot, g.a, g.b, g.reach) })

/** Distance from the centre to each focus. */
export const focalDistance = (g: Conic) => (g.type === 'ellipse' ? Math.sqrt(Math.max(0, g.a * g.a - g.b * g.b)) : g.type === 'hyperbola' ? Math.hypot(g.a, g.b) : g.a)

/** The foci (one for a parabola). */
export const conicFoci = (g: Conic): Vec[] => {
  const f = focalDistance(g)
  if (g.type === 'parabola') return [place(g.c, g.rot, g.a, 0)]
  return [place(g.c, g.rot, f, 0), place(g.c, g.rot, -f, 0)]
}

/** The vertices on the main axis, and for an ellipse the ends of the minor axis too. */
export const conicVertices = (g: Conic): Vec[] => {
  if (g.type === 'parabola') return [g.c]
  const main = [place(g.c, g.rot, g.a, 0), place(g.c, g.rot, -g.a, 0)]
  return g.type === 'ellipse' ? [...main, place(g.c, g.rot, 0, g.b), place(g.c, g.rot, 0, -g.b)] : main
}

/** The ends of the open curves. */
export const conicEnds = (g: Conic): Vec[] => (g.type === 'ellipse' ? [] : g.paths.flatMap((p) => [p[0]!, p.at(-1)!]))

/** The curve as straight pieces, for intersections and distances. */
export const conicSegments = (g: Conic): Segment[] => g.paths.flatMap((p) => p.slice(1).map((q, i) => segment(p[i]!, q)))

export const closestPointOnConic = (p: Vec, g: Conic): Vec => {
  let best = g.c
  let bestD = Infinity
  for (const path of g.paths) {
    for (let i = 1; i < path.length; i++) {
      const q = closestPointOnSegment(p, path[i - 1]!, path[i]!)
      const d = distance(p, q)
      if (d < bestD) {
        best = q
        bestD = d
      }
    }
  }
  return best
}

/** The conic moved by d. */
export const translateConic = (g: Conic, d: Vec): Conic => ({ ...g, c: add(g.c, d), paths: g.paths.map((p) => p.map((q) => add(q, d))) })

export const CONIC_NAMES: Record<ConicType, string> = { ellipse: 'Elipse', hyperbola: 'Hipérbola', parabola: 'Parábola' }
