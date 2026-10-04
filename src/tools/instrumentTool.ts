import {
  alignRotation,
  centroid,
  INSTRUMENT_MAX_SIZE,
  INSTRUMENT_MIN_SIZE,
  instrumentEdges,
  instrumentVertices,
  pointInTriangle,
  restAgainst,
  toLocal,
  type RestTarget,
} from '../geometry/instruments'
import { distance, distanceToSegment, projectPointOnLine, type Segment } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import { add, normAngle, normalize, rotate, scale, sub, toRad, wrapAngle } from '../geometry/vec'
import { appStore, updateInstrument } from '../state/appStore'
import type { InstrumentKind, InstrumentState, Vec } from '../types'
import { formatAngle } from '../utils/format'
import { segmentOverlays, snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi, ToolPointer } from './types'

const HANDLE_OFFSET_PX = 22
const HANDLE_HIT_PX = 12
const EDGE_HIT_PX = 9
const ROTATION_STEP = toRad(15)
const ROTATION_MAGNET = toRad(1.5)
/** How close (screen px / angle) an edge must come to another before it rests against it. */
const REST_PX = 10
const REST_ANGLE = toRad(4)
/** Once resting, the instrument slides along the edge until pulled this far away. */
const RELEASE_PX = 28
const POINT_SNAPS = new Set(['endpoint', 'midpoint', 'center', 'point', 'intersection'])

/** Rotation and resize handles, placed just outside the two acute vertices. */
export const instrumentHandles = (kind: InstrumentKind, state: InstrumentState, px: (n: number) => number) => {
  const [o, a, b] = instrumentVertices(kind, state)
  const out = (v: Vec) => add(v, scale(normalize(sub(v, o)), px(HANDLE_OFFSET_PX)))
  return { rotate: out(a), resize: out(b) }
}

type MoveDrag = { mode: 'move'; grabLocal: Vec; contact: string | null; target: RestTarget | null }

type Drag =
  | MoveDrag
  | { mode: 'rotate'; pivot: Vec; pos0: Vec; rot0: number; grab0: number }
  | { mode: 'resize'; size0: number; localY0: number }
  | { mode: 'draw'; edge: Segment; start: Vec; end: Vec }

const OTHER: Record<InstrumentKind, InstrumentKind> = { escuadra: 'cartabon', cartabon: 'escuadra' }

/**
 * Positions the escuadra / cartabón like the real ones: it rests flush against
 * the other instrument or a drawn line and slides along it, and it draws along
 * its own edges like a ruler.
 */
export const createInstrumentTool = (kind: InstrumentKind): Tool => {
  let drag: Drag | null = null
  let hoverEdge: Segment | null = null
  let hoverBody = false
  let hoverHandle = false
  let snap: SnapResult | null = null

  const state = () => appStore.get().instruments[kind]

  /** Edges this instrument can rest against: the other instrument and drawn lines. */
  const restTargets = (api: ToolApi): RestTarget[] => {
    const other = OTHER[kind]
    const os = appStore.get().instruments[other]
    const targets: RestTarget[] = []
    if (os.visible) {
      const body = centroid(instrumentVertices(other, os))
      instrumentEdges(other, os).forEach((seg, i) => targets.push({ key: `${other}:${i}`, seg, body }))
    }
    // Drawn lines and the exercise's own PDF lines within reach of the instrument.
    const own = state()
    const centre = centroid(instrumentVertices(kind, own))
    for (const seg of api.linesNear(centre, own.size * 1.2)) {
      const key = 'id' in seg ? String(seg.id) : `pdf:${seg.a.x.toFixed(2)},${seg.a.y.toFixed(2)},${seg.b.x.toFixed(2)},${seg.b.y.toFixed(2)}`
      targets.push({ key, seg })
    }
    return targets
  }

  const edgeAt = (p: Vec, api: ToolApi) =>
    instrumentEdges(kind, state()).find((e) => distanceToSegment(p, e.a, e.b) <= api.px(EDGE_HIT_PX)) ?? null

  const onEdge = (edge: Segment, p: Vec, api: ToolApi) => {
    snap = api.snap(p)
    return projectPointOnLine(snap.kind ? snap.p : p, edge.a, edge.b)
  }

  const moveTo = (d: MoveDrag, e: ToolPointer, api: ToolApi) => {
    const s = state()
    // The grabbed spot stays under the cursor even when resting turns the instrument.
    const proposed: InstrumentState = { ...s, pos: sub(e.world, rotate(d.grabLocal, s.rotation)) }
    snap = null
    if (!e.alt) {
      const rest = restAgainst(kind, proposed, restTargets(api), {
        distance: api.px(REST_PX),
        angle: REST_ANGLE,
        sticky: d.contact ? { contact: d.contact, distance: api.px(RELEASE_PX) } : undefined,
      })
      if (rest) {
        d.contact = rest.contact
        d.target = rest.target
        updateInstrument(kind, rest.state)
        return
      }
    }
    d.contact = null
    d.target = null
    // Free placement: the right-angle vertex can still be dropped exactly on a point.
    const hit = e.alt ? null : api.snap(proposed.pos, undefined, false)
    snap = hit?.kind && POINT_SNAPS.has(hit.kind) ? hit : null
    updateInstrument(kind, { pos: snap ? snap.p : proposed.pos })
  }

  return {
    down(e, api) {
      const s = state()
      const handles = instrumentHandles(kind, s, api.px)
      if (distance(e.world, handles.rotate) <= api.px(HANDLE_HIT_PX)) {
        const pivot = centroid(instrumentVertices(kind, s))
        drag = {
          mode: 'rotate',
          pivot,
          pos0: s.pos,
          rot0: s.rotation,
          grab0: Math.atan2(e.world.y - pivot.y, e.world.x - pivot.x),
        }
        return
      }
      if (distance(e.world, handles.resize) <= api.px(HANDLE_HIT_PX)) {
        drag = { mode: 'resize', size0: s.size, localY0: toLocal(s, e.world).y }
        return
      }
      const edge = edgeAt(e.world, api)
      if (edge) {
        const start = onEdge(edge, e.world, api)
        drag = { mode: 'draw', edge, start, end: start }
        return
      }
      if (pointInTriangle(e.world, instrumentVertices(kind, s))) {
        drag = { mode: 'move', grabLocal: toLocal(s, e.world), contact: null, target: null }
      }
    },
    move(e, api) {
      if (!drag) {
        const s = state()
        const handles = instrumentHandles(kind, s, api.px)
        hoverHandle = [handles.rotate, handles.resize].some((h) => distance(e.world, h) <= api.px(HANDLE_HIT_PX))
        hoverEdge = hoverHandle ? null : edgeAt(e.world, api)
        hoverBody = !hoverEdge && pointInTriangle(e.world, instrumentVertices(kind, s))
        snap = hoverEdge ? api.snap(e.world) : null
        return
      }
      switch (drag.mode) {
        case 'move':
          moveTo(drag, e, api)
          return
        case 'rotate': {
          const current = Math.atan2(e.world.y - drag.pivot.y, e.world.x - drag.pivot.x)
          let rotation = drag.rot0 + wrapAngle(current - drag.grab0)
          const nearest = Math.round(rotation / ROTATION_STEP) * ROTATION_STEP
          if (e.shift) rotation = nearest
          else if (!e.alt) {
            // Magnet: edges parallel to a drawn line or to the other instrument, else round angles.
            const align = alignRotation(kind, { ...state(), rotation }, restTargets(api), ROTATION_MAGNET)
            if (align !== null) rotation += align
            else if (Math.abs(rotation - nearest) < ROTATION_MAGNET) rotation = nearest
          }
          const delta = rotation - drag.rot0
          updateInstrument(kind, { rotation, pos: add(drag.pivot, rotate(sub(drag.pos0, drag.pivot), delta)) })
          return
        }
        case 'resize': {
          const localY = toLocal(state(), e.world).y
          if (Math.abs(drag.localY0) < 1e-6) return
          const size = Math.min(
            INSTRUMENT_MAX_SIZE,
            Math.max(INSTRUMENT_MIN_SIZE, (drag.size0 * localY) / drag.localY0),
          )
          updateInstrument(kind, { size })
          return
        }
        case 'draw':
          drag = { ...drag, end: onEdge(drag.edge, e.world, api) }
      }
    },
    up(_e, api) {
      if (drag?.mode === 'draw' && distance(drag.start, drag.end) > api.px(2)) {
        api.create([{ kind: 'segment', a: drag.start, b: drag.end }])
      }
      drag = null
      snap = null
    },
    cancel() {
      const had = drag !== null
      drag = null
      return had
    },
    overlays(api) {
      const out: Overlay[] = []
      if (drag?.mode === 'draw') out.push(...segmentOverlays(drag.start, drag.end, api))
      else if (hoverEdge && !drag) out.push({ kind: 'highlight', geom: hoverEdge })
      if (drag?.mode === 'move' && drag.target) out.push({ kind: 'highlight', geom: drag.target.seg })
      if (drag?.mode === 'rotate') {
        const s = state()
        out.push({
          kind: 'label',
          at: instrumentHandles(kind, s, api.px).rotate,
          text: formatAngle(normAngle(-s.rotation)),
          offset: { x: 0, y: -26 },
        })
      }
      out.push(...snapOverlay(snap))
      return out
    },
    hint() {
      if (drag?.mode === 'draw') return 'Suelta para terminar el trazo'
      if (drag?.mode === 'move' && drag.target) {
        const on = drag.target.body ? (kind === 'escuadra' ? 'en el cartabón' : 'en la escuadra') : 'sobre la línea'
        const fem = kind === 'escuadra'
        return `${fem ? 'Apoyada' : 'Apoyado'} ${on}: desliza a lo largo del borde · Alt para mover${fem ? 'la' : 'lo'} libremente`
      }
      if (drag?.mode === 'rotate') return 'Se alinea con las líneas y con el otro instrumento · Shift: pasos de 15°'
      return 'Arrastra para mover y apoyar · ⟳ gira · ⤡ tamaño · arrastra sobre un borde para trazar'
    },
    cursor() {
      if (drag?.mode === 'move' || drag?.mode === 'rotate' || drag?.mode === 'resize') return 'grabbing'
      if (hoverHandle) return 'grab'
      if (drag?.mode === 'draw' || hoverEdge) return 'crosshair'
      return hoverBody ? 'grab' : 'default'
    },
  }
}
