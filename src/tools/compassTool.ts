import { angle, arcFromPoints, circleFromCenterRadius, distance, pointOnCircle } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import { TAU, wrapAngle } from '../geometry/vec'
import { appStore } from '../state/appStore'
import type { Vec } from '../types'
import { formatAngle, formatLength } from '../utils/format'
import { snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi } from './types'

type Stage =
  | { name: 'center' }
  | { name: 'radius'; center: Vec }
  | { name: 'sweep'; center: Vec; r: number; start: number; last: number; sweep: number }
  | { name: 'measure'; from: Vec | null }

const FULL_TURN_TOL = 1e-3
/** Coming back this close (screen px) to where an arc started closes it into the whole circle. */
const CLOSE_PX = 10

/** The sweep of an arc being drawn, made a whole turn once its end comes back near its start. */
const closedSweep = (sweep: number, r: number, api: ToolApi) =>
  Math.abs(sweep) > Math.PI && (TAU - Math.abs(sweep)) * r <= api.px(CLOSE_PX) ? Math.sign(sweep) * TAU : sweep

/**
 * Compass (circles) and arc tool share one flow:
 * centre → radius point → (arcs only) sweep to the end point.
 * A memorised radius ("tomar medida") skips the radius click.
 */
export const createCompassTool = (mode: 'circle' | 'arc'): Tool => {
  let stage: Stage = { name: 'center' }
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

  const fixedRadius = () => appStore.get().compassRadius

  const sync = () => {
    const measuring = appStore.get().measuring
    if (measuring && stage.name !== 'measure') stage = { name: 'measure', from: null }
    if (!measuring && stage.name === 'measure') stage = { name: 'center' }
  }

  const startSweep = (center: Vec, r: number, towards: Vec): Stage => {
    const start = angle(center, towards)
    return { name: 'sweep', center, r, start, last: start, sweep: 0 }
  }

  const commitCircle = (api: ToolApi, center: Vec, r: number) => {
    if (r > api.px(1)) api.create([circleFromCenterRadius(center, r)])
    stage = { name: 'center' }
  }

  return {
    down(_e, api) {
      sync()
      const p = cursor
      if (!p) return
      const fixed = fixedRadius()
      switch (stage.name) {
        case 'measure':
          if (!stage.from) stage = { name: 'measure', from: p }
          else if (distance(stage.from, p) > api.px(1)) {
            appStore.set({ compassRadius: distance(stage.from, p), measuring: false })
            stage = { name: 'center' }
          }
          return
        case 'center':
          if (fixed && mode === 'circle') commitCircle(api, p, fixed)
          else stage = { name: 'radius', center: p }
          return
        case 'radius': {
          const r = fixed ?? distance(stage.center, p)
          if (r < api.px(1) || distance(stage.center, p) < api.px(1)) return
          if (mode === 'circle') commitCircle(api, stage.center, r)
          else stage = startSweep(stage.center, r, p)
          return
        }
        case 'sweep': {
          const { center, r, start } = stage
          const sweep = closedSweep(stage.sweep, r, api)
          if (Math.abs(sweep) >= TAU - FULL_TURN_TOL) api.create([circleFromCenterRadius(center, r)])
          else if (Math.abs(sweep) > 1e-3) api.create([arcFromPoints(center, pointOnCircle(center, r, start), sweep, r)])
          stage = { name: 'center' }
        }
      }
    },
    move(e, api) {
      sync()
      snap = api.snap(e.world)
      cursor = snap.p
      if (stage.name === 'sweep') {
        const current = angle(stage.center, cursor)
        const sweep = Math.max(-TAU, Math.min(TAU, stage.sweep + wrapAngle(current - stage.last)))
        stage = { ...stage, last: current, sweep }
      }
    },
    up() {},
    cancel() {
      sync()
      if (stage.name === 'measure') {
        appStore.set({ measuring: false })
        stage = { name: 'center' }
        return true
      }
      const had = stage.name !== 'center'
      stage = { name: 'center' }
      return had
    },
    overlays(api) {
      sync()
      const out: Overlay[] = []
      const p = cursor
      const fixed = fixedRadius()
      if (!p) return out
      switch (stage.name) {
        case 'measure':
          if (stage.from) {
            out.push({ kind: 'guide', a: stage.from, b: p }, { kind: 'marker', p: stage.from, label: 'A' })
            out.push({ kind: 'marker', p, label: 'B' })
            out.push({ kind: 'label', at: p, text: `AB = ${formatLength(distance(stage.from, p))}`, offset: { x: 0, y: -26 } })
          }
          break
        case 'center':
          if (fixed) {
            out.push({ kind: 'ghost', geom: circleFromCenterRadius(p, fixed), faint: mode === 'arc' })
            out.push({ kind: 'marker', p, label: 'O' })
          }
          break
        case 'radius': {
          const r = fixed ?? distance(stage.center, p)
          const edge = fixed ? pointOnCircle(stage.center, fixed, angle(stage.center, p)) : p
          out.push({ kind: 'ghost', geom: circleFromCenterRadius(stage.center, r), faint: mode === 'arc' })
          out.push({ kind: 'guide', a: stage.center, b: edge }, { kind: 'marker', p: stage.center, label: 'O' })
          out.push({ kind: 'marker', p: edge })
          out.push({ kind: 'label', at: edge, text: `R ${formatLength(r)}`, offset: { x: 0, y: -24 } })
          break
        }
        case 'sweep': {
          const { center, r, start } = stage
          const sweep = closedSweep(stage.sweep, r, api)
          const full = Math.abs(sweep) >= TAU - FULL_TURN_TOL
          const end = pointOnCircle(center, r, start + sweep)
          if (full) out.push({ kind: 'ghost', geom: circleFromCenterRadius(center, r) })
          else {
            out.push({ kind: 'ghost', geom: circleFromCenterRadius(center, r), faint: true })
            out.push({ kind: 'ghost', geom: arcFromPoints(center, pointOnCircle(center, r, start), sweep, r) })
          }
          out.push({ kind: 'guide', a: center, b: end }, { kind: 'marker', p: center, label: 'O' })
          out.push({ kind: 'marker', p: pointOnCircle(center, r, start) }, { kind: 'marker', p: end })
          out.push({
            kind: 'label',
            at: end,
            text: full ? `R ${formatLength(r)} · circunferencia completa` : `R ${formatLength(r)} · ${formatAngle(sweep)}`,
            offset: { x: 0, y: -24 },
          })
          break
        }
      }
      out.push(...snapOverlay(snap))
      return out
    },
    hint() {
      sync()
      const fixed = fixedRadius()
      switch (stage.name) {
        case 'measure':
          return stage.from ? 'Clic en el segundo punto de la medida' : 'Toma una medida: clic en el primer punto'
        case 'center':
          if (fixed && mode === 'circle') return `Clic para colocar el centro · radio fijo ${formatLength(fixed)}`
          return 'Clic para fijar el centro'
        case 'radius':
          if (fixed) return 'Clic para fijar el inicio del arco'
          return mode === 'circle' ? 'Clic para fijar el radio' : 'Clic para fijar el radio y el inicio del arco'
        case 'sweep':
          return 'Gira y haz clic para terminar el arco · vuelve al inicio para cerrar la circunferencia'
      }
    },
  }
}
