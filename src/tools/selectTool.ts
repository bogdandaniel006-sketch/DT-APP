import { constrainDirection } from '../geometry/angles'
import { angle, arcEndPoint, arcStartPoint, circleFromCenterRadius, distance, pointOnCircle } from '../geometry/primitives'
import { intersection } from '../geometry/intersections'
import { anchorOf, bounds, boundsInside, keyPoints, measurements, outlineOf, translateGeometry } from '../geometry/shapes'
import { SNAP_RADIUS_PX, type SnapResult } from '../geometry/snapping'
import { normAngle, scale, sub } from '../geometry/vec'
import { appStore } from '../state/appStore'
import { documentActions, documentStore } from '../state/documentStore'
import { isGeometry, type Shape, type Vec } from '../types'
import { suggestName } from '../pdf/detect'
import { SHIFT_STEP } from './lineTool'
import { segmentOverlays, snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi, ToolPointer } from './types'

type HandleKind = 'a' | 'b' | 'radius' | 'start' | 'end'
type Handle = { id: string; kind: HandleKind }

type Drag =
  | { mode: 'move'; ids: string[]; base: Map<string, Shape>; grab: Vec; anchor: Vec }
  | { mode: 'handle'; handle: Handle; base: Shape }
  | { mode: 'marquee'; from: Vec; to: Vec; additive: boolean }

const HANDLE_PX = 9
/** PDF snaps that can become named points from the select tool. */
const NAMEABLE = new Set(['point', 'intersection', 'endpoint', 'center', 'midpoint'])
/** Arcs never shrink to nothing while their ends are dragged. */
const MIN_SWEEP = 1e-3

/** Selected shapes in desk coordinates. */
const selectedShapes = (api: ToolApi): Shape[] => {
  const ids = new Set(appStore.get().selection)
  return api.shapes.filter((s) => ids.has(s.id))
}

const handlesOf = (s: Shape): { handle: Handle; p: Vec }[] => {
  switch (s.kind) {
    case 'segment':
      return [
        { handle: { id: s.id, kind: 'a' }, p: s.a },
        { handle: { id: s.id, kind: 'b' }, p: s.b },
      ]
    case 'circle':
      return [{ handle: { id: s.id, kind: 'radius' }, p: pointOnCircle(s.c, s.r, 0) }]
    case 'arc':
      return [
        { handle: { id: s.id, kind: 'start' }, p: arcStartPoint(s) },
        { handle: { id: s.id, kind: 'end' }, p: arcEndPoint(s) },
        { handle: { id: s.id, kind: 'radius' }, p: pointOnCircle(s.c, s.r, s.start + s.sweep / 2) },
      ]
    case 'point':
    case 'distance':
    case 'angle':
      return []
  }
}

/** New sweep keeping the arc's direction when one of its ends moves to `theta`. */
const sweepTo = (from: number, theta: number, direction: number) =>
  direction >= 0 ? normAngle(theta - from) : -normAngle(from - theta)

export const createSelectTool = (): Tool => {
  let drag: Drag | null = null
  let hover: Shape | null = null
  let snap: SnapResult | null = null

  const findHandle = (p: Vec, api: ToolApi) => {
    const sel = selectedShapes(api)
    if (sel.length !== 1) return null
    return handlesOf(sel[0]!).find((h) => distance(h.p, p) <= api.px(HANDLE_PX)) ?? null
  }

  const dragHandle = (d: Extract<Drag, { mode: 'handle' }>, e: ToolPointer, api: ToolApi) => {
    const exclude = new Set([d.handle.id])
    const base = d.base
    const kind = d.handle.kind
    if (base.kind === 'segment') {
      const fixed = kind === 'a' ? base.b : base.a
      let p: Vec
      if (e.shift) {
        p = constrainDirection(fixed, e.world, { lockStep: SHIFT_STEP }).p
        snap = null
      } else {
        snap = api.snap(e.world, exclude)
        p = snap.kind ? snap.p : constrainDirection(fixed, e.world, { extra: api.instrumentAngles }).p
      }
      const local = sub(p, api.pageOffset(base.page))
      documentActions.update([base.id], (s) => (s.kind === 'segment' ? { ...s, [kind]: local } : s))
      return
    }
    if (base.kind !== 'circle' && base.kind !== 'arc') return
    snap = api.snap(e.world, exclude)
    if (kind === 'radius') {
      const r = distance(base.c, snap.p)
      if (r > api.px(1)) documentActions.update([base.id], (s) => (s.kind === base.kind ? { ...s, r } : s))
      return
    }
    if (base.kind !== 'arc') return
    // An arc end slides along its circumference. Near a line it stops exactly where the line cuts
    // the circumference (not at the nearest point of the line, which lies off the arc).
    let target = snap.p
    if (snap.kind === 'on-line' || snap.kind === 'on-circle' || snap.kind === 'edge') {
      const circle = circleFromCenterRadius(base.c, base.r)
      const cuts = api.linesNear(e.world, api.px(SNAP_RADIUS_PX[api.snapMode])).flatMap((l) => intersection(circle, l))
      const nearest = cuts.sort((p, q) => distance(p, e.world) - distance(q, e.world))[0]
      if (nearest) {
        target = nearest
        snap = { p: nearest, kind: 'intersection', source: snap.source }
      } else target = e.world
    }
    const theta = angle(base.c, target)
    const end = base.start + base.sweep
    const next =
      kind === 'start'
        ? { start: theta, sweep: sweepTo(theta, end, base.sweep) }
        : { start: base.start, sweep: sweepTo(base.start, theta, base.sweep) }
    if (Math.abs(next.sweep) < MIN_SWEEP) return
    documentActions.update([base.id], (s) => (s.kind === 'arc' ? { ...s, ...next } : s))
  }

  /** A construction dragged onto another sheet moves to that sheet. */
  const settlePages = (ids: readonly string[], api: ToolApi) => {
    const moving = documentStore.get().shapes.filter((s) => ids.includes(s.id))
    const changes = new Map<string, Shape>()
    for (const s of moving) {
      const desk = translateGeometry(s, api.pageOffset(s.page))
      const page = api.pageAt(anchorOf(desk))
      if (page !== s.page) changes.set(s.id, { ...translateGeometry(desk, scale(api.pageOffset(page), -1)), page })
    }
    if (changes.size) documentActions.update([...changes.keys()], (s) => changes.get(s.id) ?? s)
  }

  return {
    down(e, api) {
      const handle = findHandle(e.world, api)
      if (handle) {
        const base = selectedShapes(api)[0]!
        documentActions.beginGesture()
        drag = { mode: 'handle', handle: handle.handle, base }
        return
      }
      const hit = api.hit(e.world)
      const { selection } = appStore.get()
      if (!hit) {
        if (!e.shift) appStore.set({ selection: [] })
        // A point or intersection of the PDF: offer to name it.
        const found = api.snap(e.world, undefined, false)
        if (found.source === 'pdf' && found.kind && NAMEABLE.has(found.kind)) {
          const page = api.pageAt(found.p)
          const suggestion = suggestName(page, sub(found.p, api.pageOffset(page)))
          const taken = api.shapes.some((s) => s.page === page && s.name === suggestion)
          appStore.set({ naming: { p: found.p, value: suggestion && !taken ? suggestion : api.nextPointName(found.p) } })
          return
        }
        drag = { mode: 'marquee', from: e.world, to: e.world, additive: e.shift }
        return
      }
      let next = selection
      if (e.shift) next = selection.includes(hit.id) ? selection.filter((id) => id !== hit.id) : [...selection, hit.id]
      else if (!selection.includes(hit.id)) next = [hit.id]
      appStore.set({ selection: next })
      if (!next.includes(hit.id)) return

      // Grab the shape by its nearest key point so it can be dropped precisely onto another point.
      const key = (isGeometry(hit) ? keyPoints(hit) : [])
        .filter((k) => distance(k.p, e.world) <= api.px(HANDLE_PX))
        .sort((a, b) => distance(a.p, e.world) - distance(b.p, e.world))[0]
      const shapes = documentStore.get().shapes.filter((s) => next.includes(s.id))
      documentActions.beginGesture()
      drag = {
        mode: 'move',
        ids: [...next],
        base: new Map(shapes.map((s) => [s.id, s])),
        grab: e.world,
        anchor: key?.p ?? e.world,
      }
    },
    move(e, api) {
      if (!drag) {
        hover = findHandle(e.world, api) ? null : api.hit(e.world)
        snap = null
        return
      }
      if (drag.mode === 'marquee') {
        drag = { ...drag, to: e.world }
        return
      }
      if (drag.mode === 'handle') {
        dragHandle(drag, e, api)
        return
      }
      const d = drag
      const target = sub(e.world, sub(d.grab, d.anchor))
      snap = api.snap(target, new Set(d.ids))
      const delta = sub(snap.kind ? snap.p : target, d.anchor)
      documentActions.update(d.ids, (s) => translateGeometry(d.base.get(s.id) ?? s, delta))
    },
    up(_e, api) {
      if (drag?.mode === 'marquee') {
        const { from, to, additive } = drag
        if (distance(from, to) > api.px(3)) {
          const box = {
            minX: Math.min(from.x, to.x),
            minY: Math.min(from.y, to.y),
            maxX: Math.max(from.x, to.x),
            maxY: Math.max(from.y, to.y),
          }
          const inside = api.shapes.filter((s) => boundsInside(bounds(s), box)).map((s) => s.id)
          const current = additive ? appStore.get().selection : []
          appStore.set({ selection: [...new Set([...current, ...inside])] })
        }
      } else if (drag) {
        if (drag.mode === 'move') settlePages(drag.ids, api)
        documentActions.endGesture()
      }
      drag = null
      snap = null
    },
    cancel() {
      if (drag && drag.mode !== 'marquee') {
        documentActions.cancelGesture()
        drag = null
        return true
      }
      drag = null
      if (appStore.get().selection.length) {
        appStore.set({ selection: [] })
        return true
      }
      return false
    },
    overlays(api) {
      const out: Overlay[] = []
      const sel = selectedShapes(api)
      if (hover && !sel.some((s) => s.id === hover!.id) && !drag) {
        for (const geom of outlineOf(hover)) out.push({ kind: 'highlight', geom })
      }
      if (sel.length === 1) {
        const s = sel[0]!
        if (s.kind === 'segment') out.push(...segmentOverlays(s.a, s.b, api, { ghost: false, excludeId: s.id }))
        if (s.kind === 'circle' || s.kind === 'arc') {
          const m = measurements(s)
          out.push({ kind: 'label', at: { x: s.c.x, y: s.c.y - s.r }, text: m.join(' · '), offset: { x: 0, y: -18 } })
          out.push({ kind: 'marker', p: s.c })
        }
        if (s.kind === 'arc') {
          // Radii to both ends make the angle of the arc readable, as on paper.
          out.push({ kind: 'guide', a: s.c, b: arcStartPoint(s) }, { kind: 'guide', a: s.c, b: arcEndPoint(s) })
        }
        for (const h of handlesOf(s)) out.push({ kind: 'marker', p: h.p, handle: true })
      }
      if (drag?.mode === 'marquee' && distance(drag.from, drag.to) > api.px(3)) {
        out.push({ kind: 'marquee', a: drag.from, b: drag.to })
      }
      out.push(...snapOverlay(snap))
      return out
    },
    hint() {
      const sel = appStore.get().selection
      if (!sel.length) return 'Clic en un trazo para seleccionarlo · arrastra para seleccionar varios'
      if (drag?.mode === 'handle') return drag.handle.kind === 'start' || drag.handle.kind === 'end'
        ? 'El extremo recorre la circunferencia · se ajusta a puntos e intersecciones'
        : null
      return null
    },
    cursor() {
      if (drag?.mode === 'move') return 'grabbing'
      return hover ? 'pointer' : 'default'
    },
  }
}
