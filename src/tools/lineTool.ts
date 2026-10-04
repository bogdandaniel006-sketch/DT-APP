import { constrainDirection } from '../geometry/angles'
import { distance } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import { toRad } from '../geometry/vec'
import type { Vec } from '../types'
import { segmentOverlays, snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi, ToolPointer } from './types'

export const SHIFT_STEP = toRad(15)
/** A press-drag-release longer than this (screen px) draws the line in one gesture. */
const DRAG_PX = 6

/**
 * Resolves the end point of a line from `start`: object snaps win, otherwise
 * the direction is gently snapped (or locked with Shift).
 */
export const resolveLineEnd = (
  start: Vec,
  e: ToolPointer,
  api: ToolApi,
): { p: Vec; snap: SnapResult | null; dir: number | null } => {
  if (e.shift) {
    const c = constrainDirection(start, e.world, { lockStep: SHIFT_STEP })
    return { p: c.p, snap: null, dir: c.snapped }
  }
  const snap = api.snap(e.world)
  if (snap.kind) return { p: snap.p, snap, dir: null }
  if (api.snapMode === 'libre') return { p: e.world, snap: null, dir: null }
  const c = constrainDirection(start, e.world, { extra: api.instrumentAngles })
  return { p: c.p, snap: null, dir: c.snapped }
}

export const createLineTool = (): Tool => {
  let start: Vec | null = null
  let downScreen: Vec | null = null
  let cursor: Vec | null = null
  let snap: SnapResult | null = null
  let dir: number | null = null

  const track = (e: ToolPointer, api: ToolApi) => {
    if (!start) {
      snap = api.snap(e.world)
      cursor = snap.p
      dir = null
      return
    }
    const r = resolveLineEnd(start, e, api)
    cursor = r.p
    snap = r.snap
    dir = r.dir
  }

  const finish = (api: ToolApi) => {
    if (!start || !cursor) return
    if (distance(start, cursor) < api.px(2)) api.create([{ kind: 'point', p: start }])
    else api.create([{ kind: 'segment', a: start, b: cursor }])
    start = null
    downScreen = null
  }

  return {
    down(e, api) {
      track(e, api)
      if (!start) {
        start = cursor
        downScreen = e.screen
        return
      }
      finish(api)
    },
    move(e, api) {
      track(e, api)
    },
    up(e, api) {
      if (start && downScreen && distance(downScreen, e.screen) > DRAG_PX) {
        track(e, api)
        finish(api)
      }
      downScreen = null
    },
    cancel() {
      const had = start !== null
      start = null
      downScreen = null
      return had
    },
    overlays(api) {
      const out: Overlay[] = []
      if (start && cursor) {
        if (dir !== null) out.push({ kind: 'ray', origin: start, dir })
        out.push(...segmentOverlays(start, cursor, api, { names: ['A', 'B'] }))
      }
      out.push(...snapOverlay(snap))
      return out
    },
    hint() {
      return start
        ? 'Clic para fijar el punto final · Shift bloquea el ángulo'
        : 'Clic para fijar el punto inicial · dos clics en el mismo sitio crean un punto'
    },
  }
}
