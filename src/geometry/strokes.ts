import type { Vec } from '../types'
import { closestPointOnSegment, distance, distanceToSegment } from './primitives'

/**
 * Freehand strokes: lines drawn as the pen or the finger went, to write or sketch. They are
 * kept as the points of a polyline, thinned so that a long stroke stays light.
 */
export type Stroke = { kind: 'stroke'; pts: Vec[] }

/** Closest point of the stroke to p. */
export const closestPointOnStroke = (p: Vec, s: Stroke): Vec => {
  if (s.pts.length < 2) return s.pts[0] ?? p
  let best = s.pts[0]!
  let bestD = Infinity
  for (let i = 1; i < s.pts.length; i++) {
    const q = closestPointOnSegment(p, s.pts[i - 1]!, s.pts[i]!)
    const d = distance(p, q)
    if (d < bestD) {
      best = q
      bestD = d
    }
  }
  return best
}

/**
 * The same line with fewer points (Ramer–Douglas–Peucker): every point dropped lies within
 * `tolerance` of what is kept, so the stroke looks the same.
 */
export const simplifyStroke = (pts: readonly Vec[], tolerance: number): Vec[] => {
  if (pts.length < 3) return [...pts]
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack: [number, number][] = [[0, pts.length - 1]]
  while (stack.length) {
    const [from, to] = stack.pop()!
    let far = -1
    let farD = tolerance
    for (let i = from + 1; i < to; i++) {
      const d = distanceToSegment(pts[i]!, pts[from]!, pts[to]!)
      if (d > farD) {
        far = i
        farD = d
      }
    }
    if (far < 0) continue
    keep[far] = 1
    stack.push([from, far], [far, to])
  }
  return pts.filter((_, i) => keep[i])
}
