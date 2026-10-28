import { angleMark } from '../geometry/angles'
import {
  closestPointOnSegment,
  distance,
  normalOf,
  parallel,
  perpendicular,
  projectionParam,
  projectPointOnLine,
  segment,
  type Segment,
} from '../geometry/primitives'
import type { SnapKind, SnapResult } from '../geometry/snapping'
import { mmToPt } from '../geometry/units'
import { add, dot, normalize, scale, sub } from '../geometry/vec'
import type { Vec } from '../types'
import { segmentOverlays, snapOverlay } from './overlays'
import type { Overlay, ReferenceLine, Tool, ToolApi } from './types'

/** The reference line under the cursor: a drawn segment or a line of the PDF. */
const pickLine = (api: ToolApi, p: Vec): ReferenceLine | null => api.lineAt(p)

/** Dashed continuation of the base line when the construction falls outside it. */
const extensionGuide = (base: Segment, foot: Vec): Overlay[] => {
  const t = projectionParam(foot, base.a, base.b)
  if (t >= 0 && t <= 1) return []
  return [{ kind: 'guide', a: closestPointOnSegment(foot, base.a, base.b), b: foot }]
}

const rightAngleAt = (foot: Vec, base: Segment, towards: Vec): Overlay => {
  const along = sub(base.b, base.a)
  const n = sub(towards, foot)
  return { kind: 'angle', mark: angleMark(foot, Math.atan2(along.y, along.x), Math.atan2(n.y, n.x)) }
}

/** From `from` to `to`; with Alt, as far again the other way too, so that `from` is its middle. */
const reach = (from: Vec, to: Vec, symmetric: boolean): Segment => (symmetric ? segment(sub(scale(from, 2), to), to) : segment(from, to))

/** Snaps to a stroke rather than to a point: a point near the foot of the perpendicular wins over them. */
const LOOSE_SNAPS: ReadonlySet<SnapKind> = new Set<SnapKind>(['on-line', 'on-circle', 'edge'])

/**
 * Perpendicular: pick a line, then a point. Off the line → segment from the
 * point to its foot. On the line → a third click sets the length. With Alt it grows both
 * ways, as much on the other side of the line as on the cursor's.
 */
export const createPerpendicularTool = (): Tool => {
  let base: Segment | null = null
  let baseId: string | undefined
  let through: Vec | null = null
  let hover: ReferenceLine | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null
  let symmetric = false

  const lengthEnd = (p: Vec): Vec | null => {
    if (!base || !through) return null
    const n = normalOf(base)
    return add(through, scale(n, dot(sub(p, through), n)))
  }

  const reset = () => {
    base = null
    through = null
  }

  return {
    exact() {
      return base ? { label: 'Longitud', unit: 'mm' } : null
    },
    applyExact(mm, api) {
      if (!base || mm <= 0) return
      // From its foot on the line (the one fixed, or the cursor's) towards the side the cursor is on.
      const p = cursor ?? base.b
      const foot = through ?? projectPointOnLine(p, base.a, base.b)
      const n = normalOf(base)
      const side = dot(sub(p, foot), n) < 0 ? -1 : 1
      // Symmetric, the figure typed is the whole length, half each side.
      api.create([reach(foot, add(foot, scale(n, (side * mmToPt(mm)) / (symmetric ? 2 : 1))), symmetric)])
      reset()
    },
    down(e, api) {
      if (!base) {
        const picked = pickLine(api, e.world)
        base = picked?.seg ?? null
        baseId = picked?.id
        hover = null
        return
      }
      const p = cursor ?? e.world
      symmetric = e.alt
      if (through) {
        const end = lengthEnd(p)
        if (end && distance(through, end) > api.px(2)) api.create([reach(through, end, symmetric)])
        reset()
        return
      }
      const perp = perpendicular(base, p)
      if (distance(perp.a, perp.b) > api.px(3)) {
        api.create([reach(perp.b, perp.a, symmetric)])
        reset()
      } else {
        through = perp.b
      }
    },
    move(e, api) {
      if (!base) {
        hover = pickLine(api, e.world)
        snap = null
        cursor = null
        return
      }
      symmetric = e.alt
      snap = api.snap(e.world)
      cursor = snap.p
      if (through || (snap.kind && !LOOSE_SNAPS.has(snap.kind))) return
      // Away from the line: the foot is drawn to a point of the line close to it, so the
      // perpendicular passes exactly through that point.
      const foot = projectPointOnLine(e.world, base.a, base.b)
      if (distance(foot, e.world) <= api.px(3)) return
      const at = api.snapAlong(e.world, base.a, sub(base.b, base.a))
      if (!at.kind) return
      snap = at
      cursor = add(at.p, sub(e.world, foot))
    },
    up() {},
    cancel() {
      const had = base !== null
      reset()
      return had
    },
    overlays(api) {
      if (!base) return hover ? [{ kind: 'highlight', geom: hover.seg }] : []
      const out: Overlay[] = [{ kind: 'highlight', geom: base }]
      if (!cursor) return out
      if (through) {
        const end = lengthEnd(cursor)
        out.push({ kind: 'ray', origin: through, dir: Math.atan2(normalOf(base).y, normalOf(base).x) })
        if (end && distance(through, end) > api.px(2)) {
          const drawn = reach(through, end, symmetric)
          out.push(rightAngleAt(through, base, end), ...segmentOverlays(drawn.a, drawn.b, api, { excludeId: baseId }))
        }
        return [...out, ...snapOverlay(snap)]
      }
      const perp = perpendicular(base, cursor)
      if (distance(perp.a, perp.b) > api.px(3)) {
        const drawn = reach(perp.b, perp.a, symmetric)
        out.push(...extensionGuide(base, perp.b), rightAngleAt(perp.b, base, perp.a))
        out.push(...segmentOverlays(drawn.a, drawn.b, api, { excludeId: baseId }))
      } else {
        out.push({ kind: 'ray', origin: perp.b, dir: Math.atan2(normalOf(base).y, normalOf(base).x) })
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      if (!base) return 'Selecciona la recta de referencia'
      if (through) return 'Clic para fijar la longitud de la perpendicular · o escríbela · Alt: hacia los dos lados'
      return 'Selecciona el punto por el que pasa la perpendicular · o escribe su longitud · Alt: hacia los dos lados'
    },
  }
}

/** Midpoint of a→b: a sum and a half, exact to the last bit of the coordinates. */
const midpointOf = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * Mediatriz: pick two points and their midpoint is marked. Only the point: the bisector
 * itself is then drawn by hand, as a perpendicular through it.
 */
export const createBisectorTool = (): Tool => {
  let first: Vec | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

  return {
    down(e, api) {
      snap = api.snap(e.world)
      const p = snap.p
      if (!first) {
        first = p
        return
      }
      if (distance(first, p) < api.px(2)) return
      api.create([{ kind: 'point', p: midpointOf(first, p) }])
      first = null
    },
    move(e, api) {
      snap = api.snap(e.world)
      cursor = snap.p
    },
    up() {},
    cancel() {
      const had = first !== null
      first = null
      return had
    },
    overlays(api) {
      const out: Overlay[] = []
      if (first && cursor && distance(first, cursor) >= api.px(2)) {
        out.push({ kind: 'guide', a: first, b: cursor })
        out.push({ kind: 'marker', p: first }, { kind: 'marker', p: midpointOf(first, cursor) })
      } else if (first) {
        out.push({ kind: 'marker', p: first })
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      return first ? 'Selecciona el segundo punto: se marca el punto medio para trazar la perpendicular' : 'Selecciona el primer punto'
    },
  }
}

/**
 * Parallel: pick a line, then the point it goes through, then how far it reaches: it grows from
 * that point towards the cursor, as long as wanted, like a perpendicular. With Alt it grows both
 * ways. A click without moving copies the line as it is, its own length.
 */
export const createParallelTool = (): Tool => {
  let base: Segment | null = null
  let baseId: string | undefined
  let through: Vec | null = null
  let hover: ReferenceLine | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null
  let symmetric = false

  const along = () => (base ? normalize(sub(base.b, base.a)) : { x: 1, y: 0 })

  /** Where the parallel ends for the cursor at p: p brought onto the parallel. */
  const lengthEnd = (p: Vec): Vec | null => {
    if (!through) return null
    const d = along()
    return add(through, scale(d, dot(sub(p, through), d)))
  }

  const reset = () => {
    base = null
    through = null
  }

  return {
    exact() {
      if (!base) return null
      return through ? { label: 'Longitud', unit: 'mm' } : { label: 'Distancia', unit: 'mm' }
    },
    applyExact(mm, api) {
      if (!base || mm <= 0) return
      const p = cursor ?? base.b
      if (!through) {
        // At that distance from the line, on the side the cursor is on, level with the cursor; then its length.
        const foot = projectPointOnLine(p, base.a, base.b)
        const n = normalOf(base)
        const side = dot(sub(p, foot), n) < 0 ? -1 : 1
        through = add(foot, scale(n, side * mmToPt(mm)))
        return
      }
      // Towards the cursor; symmetric, the figure typed is the whole length, half each side.
      const d = along()
      const sign = dot(sub(p, through), d) < 0 ? -1 : 1
      api.create([reach(through, add(through, scale(d, (sign * mmToPt(mm)) / (symmetric ? 2 : 1))), symmetric)])
      reset()
    },
    down(e, api) {
      if (!base) {
        const picked = pickLine(api, e.world)
        base = picked?.seg ?? null
        baseId = picked?.id
        hover = null
        return
      }
      symmetric = e.alt
      const p = snap?.p ?? e.world
      if (!through) {
        if (distance(projectPointOnLine(p, base.a, base.b), p) > api.px(2)) through = p
        return
      }
      const end = lengthEnd(p)
      // Not moved: the line copied through the point, as long as the original.
      if (!end || distance(through, end) <= api.px(3)) api.create([parallel(base, through)])
      else api.create([reach(through, end, symmetric)])
      reset()
    },
    move(e, api) {
      if (!base) {
        hover = pickLine(api, e.world)
        return
      }
      symmetric = e.alt
      if (!through) {
        snap = api.snap(e.world)
        cursor = snap.p
        return
      }
      // The end slides along the parallel, stopping where it meets other strokes.
      snap = api.snapAlong(e.world, through, sub(base.b, base.a))
      cursor = snap.p
    },
    up() {},
    cancel() {
      const had = base !== null
      reset()
      return had
    },
    overlays(api) {
      if (!base) return hover ? [{ kind: 'highlight', geom: hover.seg }] : []
      const out: Overlay[] = [{ kind: 'highlight', geom: base }]
      if (!cursor) return out
      if (!through) {
        const foot = projectPointOnLine(cursor, base.a, base.b)
        if (distance(foot, cursor) > api.px(2)) {
          const copy = parallel(base, cursor)
          out.push({ kind: 'guide', a: foot, b: cursor }, { kind: 'ghost', geom: copy, faint: true }, { kind: 'marker', p: cursor })
        }
        return [...out, ...snapOverlay(snap)]
      }
      const d = along()
      out.push({ kind: 'ray', origin: through, dir: Math.atan2(d.y, d.x) }, { kind: 'marker', p: through })
      const end = lengthEnd(cursor)
      if (end && distance(through, end) > api.px(3)) {
        const drawn = reach(through, end, symmetric)
        out.push(...segmentOverlays(drawn.a, drawn.b, api, { excludeId: baseId }))
      } else {
        out.push({ kind: 'ghost', geom: parallel(base, through), faint: true })
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      if (!base) return 'Selecciona la recta de referencia'
      if (!through) return 'Selecciona el punto por el que pasa la paralela · o escribe la distancia'
      return 'Mueve el cursor para alargarla y haz clic · o escribe su longitud · Alt: hacia los dos lados · clic sin mover: igual que la original'
    },
  }
}
