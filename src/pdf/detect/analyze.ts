import { intersection, lineLineIntersection } from '../../geometry/intersections'
import { distance, midpoint, projectionParam, segment, type Arc, type Circle, type Segment } from '../../geometry/primitives'
import { SpatialIndex } from '../../geometry/spatialIndex'
import { bounds } from '../../geometry/shapes'
import { mmToPt } from '../../geometry/units'
import { TAU, toRad } from '../../geometry/vec'
import type { Geometry, Vec } from '../../types'
import type { Piece, TextLabel, VectorPath } from './vectors'

export interface DetectedGeometry {
  lines: Segment[]
  circles: Circle[]
  arcs: Arc[]
  /** Point markers drawn in the exercise: small crosses and dots. */
  points: Vec[]
  intersections: Vec[]
  labels: TextLabel[]
}

/** Markers are tiny: a cross arm or a dot radius below these sizes is a point, not a line or circle. */
const MARKER_ARM = mmToPt(5)
const MARKER_RADIUS = mmToPt(1.6)
const MIN_LINE = mmToPt(0.8)
const MAX_INTERSECTIONS = 20000

const bezier = (c: Extract<Piece, { t: 'C' }>, t: number): Vec => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const d = 3 * u * t * t
  const e = t * t * t
  return {
    x: a * c.p0.x + b * c.p1.x + d * c.p2.x + e * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + d * c.p2.y + e * c.p3.y,
  }
}

/** Algebraic (Kåsa) circle fit, then the worst radial deviation of the samples. */
export const fitCircle = (pts: readonly Vec[]): { c: Vec; r: number; error: number } | null => {
  if (pts.length < 3) return null
  // Centre the data for numerical stability.
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0
  for (const p of pts) {
    const u = p.x - mx
    const v = p.y - my
    suu += u * u
    svv += v * v
    suv += u * v
    suuu += u * u * u
    svvv += v * v * v
    suvv += u * v * v
    svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-12) return null
  const b1 = (suuu + suvv) / 2
  const b2 = (svvv + svuu) / 2
  const uc = (b1 * svv - b2 * suv) / det
  const vc = (b2 * suu - b1 * suv) / det
  const c = { x: uc + mx, y: vc + my }
  const r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / pts.length)
  let error = 0
  for (const p of pts) error = Math.max(error, Math.abs(distance(p, c) - r))
  return { c, r, error }
}

/**
 * Exact centre of a run of circular Bézier pieces: the normals at the run's two
 * ends meet at the centre (their end points lie exactly on the circle, unlike
 * the curve's interior, which deviates by up to 0.03 %).
 */
const exactCircle = (run: readonly Extract<Piece, { t: 'C' }>[]): { c: Vec; r: number } | null => {
  const first = run[0]!
  const last = run[run.length - 1]!
  const t0 = { x: first.p1.x - first.p0.x, y: first.p1.y - first.p0.y }
  const n0 = { x: first.p0.x - t0.y, y: first.p0.y + t0.x }
  const normalAtEnd = (c: Extract<Piece, { t: 'C' }>) => {
    const t = { x: c.p3.x - c.p2.x, y: c.p3.y - c.p2.y }
    return { x: c.p3.x - t.y, y: c.p3.y + t.x }
  }
  // A full circle ends where it starts: use the first piece's own two ends instead.
  const closed = distance(first.p0, last.p3) < 1e-6
  const other = closed ? first : last
  const hit = lineLineIntersection(first.p0, n0, other.p3, normalAtEnd(other))
  if (!hit) return null
  const ends = [first.p0, ...run.map((c) => c.p3)]
  const r = ends.reduce((sum, p) => sum + distance(p, hit.p), 0) / ends.length
  return { c: hit.p, r }
}

/** Turns an ordered run of points on a circle into a circle or an arc with its true sweep. */
const roundFromSamples = (samples: readonly Vec[], exact?: { c: Vec; r: number } | null): Circle | Arc | null => {
  const fit = fitCircle(samples)
  if (!fit || fit.r < 0.5 || fit.error > Math.max(0.2, fit.r * 0.006)) return null
  // Prefer the exact centre when it agrees with the fit.
  const agree = Math.max(0.3, fit.r * 0.01)
  if (exact && distance(exact.c, fit.c) < agree && Math.abs(exact.r - fit.r) < agree) {
    fit.c = exact.c
    fit.r = exact.r
  }
  const angles = samples.map((p) => Math.atan2(p.y - fit.c.y, p.x - fit.c.x))
  let sweep = 0
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i]! - angles[i - 1]!
    if (d > Math.PI) d -= TAU
    if (d < -Math.PI) d += TAU
    sweep += d
  }
  if (Math.abs(sweep) >= TAU - toRad(3)) return { kind: 'circle', c: fit.c, r: fit.r }
  if (Math.abs(sweep) < toRad(2)) return null
  return { kind: 'arc', c: fit.c, r: fit.r, start: angles[0]!, sweep }
}

interface RawElements {
  segments: Segment[]
  rounds: (Circle | Arc)[]
  dots: Vec[]
}

/** Splits each subpath into straight pieces and circular runs (bezier or finely polygonal). */
const readPath = (path: VectorPath, out: RawElements) => {
  for (const sub of path.subpaths) {
    const pieces = sub.pieces
    // Filled tiny closed shapes are dots (point markers); larger fills are ignored (glyphs, areas).
    if (path.filled && !path.stroked) {
      const pts = pieces.flatMap((p) => (p.t === 'L' ? [p.a] : [p.p0, bezier(p, 0.5)]))
      const fit = fitCircle(pts)
      if (fit && fit.r <= MARKER_RADIUS && fit.error < Math.max(0.3, fit.r * 0.25)) {
        out.dots.push(fit.c)
        continue
      }
      // A very thin filled rectangle is how some programs draw a line.
      if (pieces.length >= 4 && pieces.length <= 5 && pieces.every((p) => p.t === 'L')) {
        const lens = pieces.slice(0, 4).map((p) => (p.t === 'L' ? distance(p.a, p.b) : 0))
        const [l0, l1] = lens as [number, number]
        const thin = Math.min(l0, l1)
        const long = Math.max(l0, l1)
        if (thin < 1.2 && long > MIN_LINE * 3) {
          const p = pieces as Extract<Piece, { t: 'L' }>[]
          const mid = (s: Extract<Piece, { t: 'L' }>) => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 })
          out.segments.push(l0 < l1 ? segment(mid(p[0]!), mid(p[2]!)) : segment(mid(p[1]!), mid(p[3]!)))
        }
      }
      continue
    }
    if (!path.stroked) continue

    let i = 0
    while (i < pieces.length) {
      const piece = pieces[i]!
      if (piece.t === 'C') {
        // A run of curves: fit as one circle/arc, or fall back to each curve on its own.
        const run: Extract<Piece, { t: 'C' }>[] = []
        while (i < pieces.length && pieces[i]!.t === 'C') run.push(pieces[i++] as Extract<Piece, { t: 'C' }>)
        const samples = [run[0]!.p0, ...run.flatMap((c) => [bezier(c, 0.25), bezier(c, 0.5), bezier(c, 0.75), c.p3])]
        const round = roundFromSamples(samples, exactCircle(run))
        if (round) out.rounds.push(round)
        else {
          for (const c of run) {
            const r = roundFromSamples([c.p0, bezier(c, 0.25), bezier(c, 0.5), bezier(c, 0.75), c.p3], exactCircle([c]))
            if (r) out.rounds.push(r)
          }
        }
        continue
      }
      // A long run of short straight pieces may be a polygonal circle (CAD exports).
      let j = i
      while (j < pieces.length && pieces[j]!.t === 'L') j++
      const lines = pieces.slice(i, j) as Extract<Piece, { t: 'L' }>[]
      if (lines.length >= 12) {
        const pts = [lines[0]!.a, ...lines.map((l) => l.b)]
        const round = roundFromSamples(pts)
        if (round && lines.every((l) => distance(l.a, l.b) < round.r * 0.6)) {
          out.rounds.push(round)
          i = j
          continue
        }
      }
      for (const l of lines) if (distance(l.a, l.b) >= 0.2) out.segments.push(segment(l.a, l.b))
      i = j
    }
  }
}

/** Two short strokes crossing near their middles: an "×" or "+" marking a point. */
const extractCrosses = (segments: Segment[]): { points: Vec[]; rest: Segment[] } => {
  const short = segments.map((s, i) => ({ s, i })).filter(({ s }) => distance(s.a, s.b) <= MARKER_ARM * 2)
  const used = new Set<number>()
  const points: Vec[] = []
  for (let x = 0; x < short.length; x++) {
    const A = short[x]!
    if (used.has(A.i)) continue
    for (let y = x + 1; y < short.length; y++) {
      const B = short[y]!
      if (used.has(B.i)) continue
      const hit = lineLineIntersection(A.s.a, A.s.b, B.s.a, B.s.b)
      if (!hit || Math.abs(hit.t - 0.5) > 0.2 || Math.abs(hit.u - 0.5) > 0.2) continue
      const angleA = Math.atan2(A.s.b.y - A.s.a.y, A.s.b.x - A.s.a.x)
      const angleB = Math.atan2(B.s.b.y - B.s.a.y, B.s.b.x - B.s.a.x)
      const diff = Math.abs(Math.sin(angleA - angleB))
      if (diff < Math.sin(toRad(30))) continue
      points.push(hit.p)
      used.add(A.i)
      used.add(B.i)
      break
    }
  }
  return { points, rest: segments.filter((_, i) => !used.has(i)) }
}

/** Joins duplicated and collinear touching segments (lines drawn twice or in pieces). */
export const mergeCollinear = (segments: readonly Segment[], tol = 0.25, maxGap = tol): Segment[] => {
  const items = segments
    .filter((s) => distance(s.a, s.b) >= MIN_LINE)
    .map((s) => ({ s, angle: ((Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) % Math.PI) + Math.PI) % Math.PI }))
    .sort((p, q) => p.angle - q.angle)
  const out: Segment[] = []
  const done = new Array(items.length).fill(false)
  for (let i = 0; i < items.length; i++) {
    if (done[i]) continue
    let { a, b } = items[i]!.s
    for (let j = i + 1; j < items.length; j++) {
      if (items[j]!.angle - items[i]!.angle > toRad(0.3)) break
      if (done[j]) continue
      const o = items[j]!.s
      const len = distance(a, b)
      const offA = Math.abs(((o.a.x - a.x) * (b.y - a.y) - (o.a.y - a.y) * (b.x - a.x)) / len)
      const offB = Math.abs(((o.b.x - a.x) * (b.y - a.y) - (o.b.y - a.y) * (b.x - a.x)) / len)
      if (offA > tol || offB > tol) continue
      const t0 = projectionParam(o.a, a, b)
      const t1 = projectionParam(o.b, a, b)
      const gap = maxGap / len
      if (Math.max(t0, t1) < -gap || Math.min(t0, t1) > 1 + gap) continue
      const lo = Math.min(0, t0, t1)
      const hi = Math.max(1, t0, t1)
      const na = { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo }
      const nb = { x: a.x + (b.x - a.x) * hi, y: a.y + (b.y - a.y) * hi }
      a = na
      b = nb
      done[j] = true
    }
    out.push(segment(a, b))
  }
  return out
}

const dedupeRounds = (rounds: readonly (Circle | Arc)[]): { circles: Circle[]; arcs: Arc[] } => {
  const circles: Circle[] = []
  const arcs: Arc[] = []
  for (const r of rounds) {
    const same = (c: Circle) => distance(c.c, r.c) < 0.3 && Math.abs(c.r - r.r) < 0.3
    if (r.kind === 'circle') {
      if (!circles.some(same)) circles.push(r)
    } else if (!circles.some(same)) arcs.push(r)
  }
  // Arcs lying on a full circle add nothing.
  return { circles, arcs: arcs.filter((a) => !circles.some((c) => distance(c.c, a.c) < 0.3 && Math.abs(c.r - a.r) < 0.3)) }
}

const dedupePoints = (pts: readonly Vec[], tol = 0.3): Vec[] => {
  const out: Vec[] = []
  for (const p of pts) if (!out.some((q) => distance(p, q) < tol)) out.push(p)
  return out
}

/** Intersections between all detected curves, using a grid so only nearby pairs are tested. */
export const computeIntersections = (curves: readonly Geometry[]): Vec[] => {
  const index = new SpatialIndex<number>(36)
  curves.forEach((g, i) => index.insert(i, bounds(g)))
  const seen = new Set<string>()
  const out: Vec[] = []
  for (let i = 0; i < curves.length && out.length < MAX_INTERSECTIONS; i++) {
    const b = bounds(curves[i]!)
    const centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
    const r = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2
    for (const j of index.query(centre, r)) {
      if (j <= i) continue
      for (const p of intersection(curves[i]!, curves[j]!)) {
        const key = `${Math.round(p.x * 20)},${Math.round(p.y * 20)}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(p)
      }
    }
  }
  return out
}

export const analyzeVectors = (paths: readonly VectorPath[], labels: readonly TextLabel[]): DetectedGeometry => {
  const raw: RawElements = { segments: [], rounds: [], dots: [] }
  for (const p of paths) readPath(p, raw)

  const { points: crosses, rest } = extractCrosses(raw.segments)
  const smallRounds = raw.rounds.filter((r) => r.kind === 'circle' && r.r <= MARKER_RADIUS)
  const { circles, arcs } = dedupeRounds(raw.rounds.filter((r) => !(r.kind === 'circle' && r.r <= MARKER_RADIUS)))
  const lines = mergeCollinear(rest)
  const points = dedupePoints([...crosses, ...raw.dots, ...smallRounds.map((r) => r.c)])
  const intersections = computeIntersections([...lines, ...circles, ...arcs])
  return { lines, circles, arcs, points, intersections, labels: [...labels] }
}

/** Name suggested for a point: the nearest short label of the exercise (A, B, O', P1…). */
export const LABEL_PATTERN = /^[A-ZÑ][0-9]{0,2}['’′´`]{0,3}$/

export const nearestLabel = (labels: readonly TextLabel[], p: Vec, maxDistance = mmToPt(9)): string | null => {
  let best: string | null = null
  let bestD = maxDistance
  for (const l of labels) {
    const text = l.text.replace(/[’′´`]/g, "'")
    if (!LABEL_PATTERN.test(text)) continue
    const d = distance(l.p, p)
    if (d < bestD) {
      best = text
      bestD = d
    }
  }
  return best
}

/**
 * Scans turn a circle into a chain of short chords. Chains that bend steadily
 * are fitted back into circles (or arcs); chains lying on one circle are joined.
 */
export const roundsFromChords = (segments: readonly Segment[]): { rounds: (Circle | Arc)[]; rest: Segment[] } => {
  const GAP = mmToPt(2.5)
  const n = segments.length
  const dir = (s: Segment) => Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x)
  const turnBetween = (s: Segment, t: Segment) => Math.abs(Math.atan2(Math.sin(dir(t) - dir(s)), Math.cos(dir(t) - dir(s))))
  const used: boolean[] = new Array(n).fill(false)
  const chains: Segment[][] = []
  for (let i = 0; i < n; i++) {
    if (used[i]) continue
    used[i] = true
    let chain: Segment[] = [segments[i]!]
    for (const forward of [true, false]) {
      for (;;) {
        const end = forward ? chain[chain.length - 1]! : chain[0]!
        const tip = forward ? end.b : end.a
        let found = -1
        let oriented: Segment | null = null
        for (let j = 0; j < n && found < 0; j++) {
          if (used[j]) continue
          const s = segments[j]!
          let cand: Segment | null = null
          if (forward) cand = distance(s.a, tip) <= GAP ? s : distance(s.b, tip) <= GAP ? segment(s.b, s.a) : null
          else cand = distance(s.b, tip) <= GAP ? s : distance(s.a, tip) <= GAP ? segment(s.b, s.a) : null
          if (!cand) continue
          const turn = forward ? turnBetween(end, cand) : turnBetween(cand, end)
          if (turn > toRad(50) || turn < toRad(0.5)) continue
          found = j
          oriented = cand
        }
        if (found < 0 || !oriented) break
        used[found] = true
        chain = forward ? [...chain, oriented] : [oriented, ...chain]
      }
    }
    chains.push(chain)
  }

  type Group = { c: Vec; r: number; chains: Segment[][] }
  const groups: Group[] = []
  const rest: Segment[] = []
  for (const chain of chains) {
    const fit = chain.length >= 3 ? fitCircle(chain.flatMap((s) => [s.a, s.b])) : null
    if (!fit || fit.error > 1.5 || fit.r > mmToPt(300)) {
      rest.push(...chain)
      continue
    }
    const same = groups.find((g) => distance(g.c, fit.c) < 3 && Math.abs(g.r - fit.r) < 3)
    if (same) same.chains.push(chain)
    else groups.push({ c: fit.c, r: fit.r, chains: [chain] })
  }

  // Short loose chords lying on a recognised circle belong to it too.
  const loose: Segment[] = []
  for (const sgm of rest) {
    const g = groups.find((g) => [sgm.a, sgm.b, midpoint(sgm.a, sgm.b)].every((q) => Math.abs(distance(q, g.c) - g.r) < 1.5))
    if (g && distance(sgm.a, sgm.b) < g.r) g.chains.push([sgm])
    else loose.push(sgm)
  }
  rest.length = 0
  rest.push(...loose)

  const rounds: (Circle | Arc)[] = []
  for (const g of groups) {
    const fit = fitCircle(g.chains.flat().flatMap((s) => [s.a, s.b])) ?? { c: g.c, r: g.r, error: 0 }
    const span = (chain: Segment[]) =>
      chain.reduce((sum, s) => {
        const a0 = Math.atan2(s.a.y - fit.c.y, s.a.x - fit.c.x)
        const a1 = Math.atan2(s.b.y - fit.c.y, s.b.x - fit.c.x)
        return sum + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0))
      }, 0)
    // A full circle interrupted where other strokes cross it has only small gaps; a real arc leaves a big one.
    const intervals = g.chains
      .map((ch) => {
        const a0 = Math.atan2(ch[0]!.a.y - fit.c.y, ch[0]!.a.x - fit.c.x)
        const sw = span(ch)
        const lo = sw >= 0 ? a0 : a0 + sw
        return { lo: ((lo % TAU) + TAU) % TAU, len: Math.abs(sw) }
      })
      .sort((x, y) => x.lo - y.lo)
    let largestGap = 0
    intervals.forEach((iv, k) => {
      const next = intervals[(k + 1) % intervals.length]!
      const end = iv.lo + iv.len
      const gap = k === intervals.length - 1 ? next.lo + TAU - end : next.lo - end
      largestGap = Math.max(largestGap, gap)
    })
    if (intervals.length > 1 && largestGap < toRad(45)) {
      rounds.push({ kind: 'circle', c: fit.c, r: fit.r })
      continue
    }
    for (const ch of g.chains) {
      rounds.push({ kind: 'arc', c: fit.c, r: fit.r, start: Math.atan2(ch[0]!.a.y - fit.c.y, ch[0]!.a.x - fit.c.x), sweep: span(ch) })
    }
  }
  return { rounds, rest }
}
