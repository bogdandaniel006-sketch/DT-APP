import { distance } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import type { Vec } from '../types'
import { resolveLineEnd } from './lineTool'
import { snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi, ToolPointer } from './types'

/** A press-drag-release longer than this (screen px) draws the dimension in one gesture. */
const DRAG_PX = 6

/**
 * Cota: a line with an arrowhead at each end and its figure above, between two points —
 * usually from one extension line to the other, to which both ends snap. The figure is
 * the measured length until another is typed for it.
 */
export const createDimensionTool = (): Tool => {
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
    if (distance(start, cursor) >= api.px(4)) api.create([{ kind: 'segment', a: start, b: cursor, dimension: true }])
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
    overlays() {
      const out: Overlay[] = []
      if (start && cursor) {
        if (dir !== null) out.push({ kind: 'ray', origin: start, dir })
        out.push({ kind: 'ghost', geom: { kind: 'segment', a: start, b: cursor } })
        out.push({ kind: 'marker', p: start }, { kind: 'marker', p: cursor })
      }
      out.push(...snapOverlay(snap))
      return out
    },
    hint() {
      return start
        ? 'Clic donde acaba la cota · Shift bloquea el ángulo'
        : 'Clic donde empieza la cota, sobre la línea auxiliar · la cifra se puede cambiar al seleccionarla'
    },
  }
}
