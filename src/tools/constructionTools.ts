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
import type { SnapResult } from '../geometry/snapping'
import { add, dot, scale, sub } from '../geometry/vec'
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

/**
 * Perpendicular: pick a line, then a point. Off the line → segment from the
 * point to its foot. On the line → a third click sets the length.
 */
export const createPerpendicularTool = (): Tool => {
  let base: Segment | null = null
  let baseId: string | undefined
  let through: Vec | null = null
  let hover: ReferenceLine | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

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
    down(e, api) {
      if (!base) {
        const picked = pickLine(api, e.world)
        base = picked?.seg ?? null
        baseId = picked?.id
        hover = null
        return
      }
      const p = snap?.p ?? e.world
      if (through) {
        const end = lengthEnd(p)
        if (end && distance(through, end) > api.px(2)) api.create([segment(through, end)])
        reset()
        return
      }
      const perp = perpendicular(base, p)
      if (distance(perp.a, perp.b) > api.px(3)) {
        api.create([perp])
        reset()
      } else {
        through = perp.b
      }
    },
    move(e, api) {
      if (!base) {
        hover = pickLine(api, e.world)
        snap = null
        return
      }
      snap = api.snap(e.world)
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
      if (through) {
        const end = lengthEnd(cursor)
        out.push({ kind: 'ray', origin: through, dir: Math.atan2(normalOf(base).y, normalOf(base).x) })
        if (end && distance(through, end) > api.px(2)) {
          out.push(rightAngleAt(through, base, end), ...segmentOverlays(through, end, api, { excludeId: baseId }))
        }
        return [...out, ...snapOverlay(snap)]
      }
      const perp = perpendicular(base, cursor)
      if (distance(perp.a, perp.b) > api.px(3)) {
        out.push(...extensionGuide(base, perp.b), rightAngleAt(perp.b, base, perp.a))
        out.push(...segmentOverlays(perp.a, perp.b, api, { excludeId: baseId }))
      } else {
        out.push({ kind: 'ray', origin: perp.b, dir: Math.atan2(normalOf(base).y, normalOf(base).x) })
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      if (!base) return 'Selecciona la recta de referencia'
      if (through) return 'Clic para fijar la longitud de la perpendicular'
      return 'Selecciona el punto por el que pasa la perpendicular'
    },
  }
}

/** Parallel: pick a line, then a point; the line is copied through that point. */
export const createParallelTool = (): Tool => {
  let base: Segment | null = null
  let baseId: string | undefined
  let hover: ReferenceLine | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

  return {
    down(e, api) {
      if (!base) {
        const picked = pickLine(api, e.world)
        base = picked?.seg ?? null
        baseId = picked?.id
        hover = null
        return
      }
      const p = snap?.p ?? e.world
      const copy = parallel(base, p)
      if (distance(projectPointOnLine(p, base.a, base.b), p) > api.px(2)) api.create([copy])
      base = null
    },
    move(e, api) {
      if (!base) {
        hover = pickLine(api, e.world)
        return
      }
      snap = api.snap(e.world)
      cursor = snap.p
    },
    up() {},
    cancel() {
      const had = base !== null
      base = null
      return had
    },
    overlays(api) {
      if (!base) return hover ? [{ kind: 'highlight', geom: hover.seg }] : []
      const out: Overlay[] = [{ kind: 'highlight', geom: base }]
      if (!cursor) return out
      const copy = parallel(base, cursor)
      const foot = projectPointOnLine(cursor, base.a, base.b)
      if (distance(foot, cursor) > api.px(2)) {
        out.push({ kind: 'guide', a: foot, b: cursor })
        out.push(...segmentOverlays(copy.a, copy.b, api, { excludeId: baseId }))
        out.push({ kind: 'marker', p: cursor })
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      return base ? 'Selecciona el punto por el que pasa la paralela' : 'Selecciona la recta de referencia'
    },
  }
}
