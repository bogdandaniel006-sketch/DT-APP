import type { InstrumentKind, InstrumentState, Vec } from '../types'
import { distance, midpoint, projectionParam, segment, type Segment } from './primitives'
import { add, cross, normalize, rotate, scale, sub, wrapAngle } from './vec'
import { mmToPt } from './units'

export const INSTRUMENT_MIN_SIZE = mmToPt(40)
export const INSTRUMENT_MAX_SIZE = mmToPt(420)

/**
 * Local outline with the right angle at the origin and the long leg along +x.
 * Escuadra: 45°-45°-90°. Cartabón: 30°-60°-90° (short leg = long leg / √3).
 * Turned over, the short leg points the other way (a mirror image).
 */
export const localVertices = (kind: InstrumentKind, size: number, flipped = false): [Vec, Vec, Vec] => {
  const short = kind === 'escuadra' ? size : size / Math.sqrt(3)
  return [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: 0, y: flipped ? short : -short },
  ]
}

export const toWorld = (state: InstrumentState, local: Vec): Vec => add(state.pos, rotate(local, state.rotation))
export const toLocal = (state: InstrumentState, world: Vec): Vec => rotate(sub(world, state.pos), -state.rotation)

export const instrumentVertices = (kind: InstrumentKind, state: InstrumentState): [Vec, Vec, Vec] => {
  const [a, b, c] = localVertices(kind, state.size, state.flipped)
  return [toWorld(state, a), toWorld(state, b), toWorld(state, c)]
}

export const instrumentEdges = (kind: InstrumentKind, state: InstrumentState): Segment[] => {
  const [o, a, b] = instrumentVertices(kind, state)
  return [segment(o, a), segment(a, b), segment(b, o)]
}

export const centroid = (pts: readonly Vec[]): Vec =>
  scale(
    pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0 }),
    1 / pts.length,
  )

/** Inner cut-out: the outline shrunk towards the incentre. */
export const innerVertices = (verts: [Vec, Vec, Vec], ratio = 0.5): [Vec, Vec, Vec] => {
  const [A, B, C] = verts
  const a = Math.hypot(B.x - C.x, B.y - C.y)
  const b = Math.hypot(A.x - C.x, A.y - C.y)
  const c = Math.hypot(A.x - B.x, A.y - B.y)
  const p = a + b + c
  const incenter = { x: (a * A.x + b * B.x + c * C.x) / p, y: (a * A.y + b * B.y + c * C.y) / p }
  const shrink = (v: Vec) => add(incenter, scale(sub(v, incenter), ratio))
  return [shrink(A), shrink(B), shrink(C)]
}

export const pointInTriangle = (p: Vec, [a, b, c]: readonly [Vec, Vec, Vec]): boolean => {
  const d1 = cross(sub(b, a), sub(p, a))
  const d2 = cross(sub(c, b), sub(p, b))
  const d3 = cross(sub(a, c), sub(p, c))
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** A straight edge an instrument can rest against. */
export interface RestTarget {
  key: string
  seg: Segment
  /** Centre of the body the edge belongs to; an instrument must rest on the outside of it. */
  body?: Vec
}

export interface Rest {
  state: InstrumentState
  target: RestTarget
  /** Key identifying the (target, moving edge) contact, to keep it sticky while sliding. */
  contact: string
}

const rotateAbout = (state: InstrumentState, pivot: Vec, delta: number): InstrumentState => ({
  ...state,
  rotation: state.rotation + delta,
  pos: add(pivot, rotate(sub(state.pos, pivot), delta)),
})

const sideOf = (seg: Segment, p: Vec) => Math.sign(cross(sub(seg.b, seg.a), sub(p, seg.a)))

/**
 * Lays the instrument flush against the nearest compatible edge: one of its
 * edges is rotated parallel to the target and slid onto its line, as when a
 * cartabón is pressed against an escuadra or placed on a drawn line.
 * Only contacts where both edges overlap count, so it "falls off" at the ends.
 */
export const restAgainst = (
  kind: InstrumentKind,
  proposed: InstrumentState,
  targets: readonly RestTarget[],
  options: { distance: number; angle: number; sticky?: { contact: string; distance: number } },
): Rest | null => {
  let best: (Rest & { score: number }) | null = null
  const moving = instrumentEdges(kind, proposed)
  for (const target of targets) {
    const t = target.seg
    const tLen = distance(t.a, t.b)
    if (tLen < 1e-6) continue
    const tDir = normalize(sub(t.b, t.a))
    moving.forEach((m, edgeIndex) => {
      const contact = `${target.key}:${edgeIndex}`
      const sticky = options.sticky?.contact === contact
      const dirT = Math.atan2(t.b.y - t.a.y, t.b.x - t.a.x)
      const dirM = Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x)
      // Edges are lines: compare directions modulo 180°.
      const dTheta = wrapAngle(2 * (dirT - dirM)) / 2
      if (!sticky && Math.abs(dTheta) > options.angle) return
      const turned = rotateAbout(proposed, midpoint(m.a, m.b), dTheta)
      const edge = instrumentEdges(kind, turned)[edgeIndex]!
      const gap = cross(tDir, sub(midpoint(edge.a, edge.b), t.a))
      if (Math.abs(gap) > (sticky ? options.sticky!.distance : options.distance)) return
      const u0 = projectionParam(edge.a, t.a, t.b)
      const u1 = projectionParam(edge.b, t.a, t.b)
      const overlap = (Math.min(Math.max(u0, u1), 1) - Math.max(Math.min(u0, u1), 0)) * tLen
      if (overlap <= 0) return
      const n = { x: -tDir.y, y: tDir.x }
      const placed = { ...turned, pos: sub(turned.pos, scale(n, gap)) }
      if (target.body) {
        const own = centroid(instrumentVertices(kind, placed))
        if (sideOf(t, own) === sideOf(t, target.body)) return
      }
      const score = Math.abs(gap) + Math.abs(dTheta) * tLen * 0.1 - (sticky ? 1e6 : 0)
      if (!best || score < best.score) best = { state: placed, target, contact, score }
    })
  }
  if (!best) return null
  const { state, target, contact } = best as Rest & { score: number }
  return { state, target, contact }
}

/** Smallest rotation (modulo 180°) that makes one of the instrument's edges parallel to a target. */
export const alignRotation = (
  kind: InstrumentKind,
  state: InstrumentState,
  targets: readonly RestTarget[],
  tolerance: number,
): number | null => {
  let best: number | null = null
  for (const m of instrumentEdges(kind, state)) {
    const dirM = Math.atan2(m.b.y - m.a.y, m.b.x - m.a.x)
    for (const { seg: t } of targets) {
      const d = wrapAngle(2 * (Math.atan2(t.b.y - t.a.y, t.b.x - t.a.x) - dirM)) / 2
      if (Math.abs(d) <= tolerance && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
  }
  return best
}
