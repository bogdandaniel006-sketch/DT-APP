import { pencilStroke } from '../canvas/style'
import { distance } from '../geometry/primitives'
import { simplifyStroke } from '../geometry/strokes'
import { appStore } from '../state/appStore'
import type { Vec } from '../types'
import type { Tool } from './types'

/** Points closer than this on screen are not kept while drawing. */
const STEP_PX = 1.5
/** How far on screen the kept line may stray from the drawn one once thinned. */
const TOLERANCE_PX = 0.35

/**
 * Freehand: the pen, the finger or the mouse draws exactly where it goes, to write a name, a
 * note or a sketch, as on the touch boards of a classroom. Nothing snaps; it uses the pencil
 * of the layer like any other stroke.
 */
export const createFreehandTool = (): Tool => {
  let pts: Vec[] | null = null

  return {
    down(e) {
      pts = [e.world]
    },
    move(e, api) {
      if (!pts) return
      if (distance(pts[pts.length - 1]!, e.world) >= api.px(STEP_PX)) pts.push(e.world)
    },
    up(e, api) {
      if (!pts) return
      if (distance(pts[pts.length - 1]!, e.world) > 0) pts.push(e.world)
      const drawn = simplifyStroke(pts, api.px(TOLERANCE_PX))
      pts = null
      api.create([{ kind: 'stroke', pts: drawn }])
    },
    cancel() {
      const had = pts !== null
      pts = null
      return had
    },
    cursor() {
      return 'crosshair'
    },
    overlays() {
      if (!pts) return []
      const { pencil, darkSheet } = appStore.get()
      const { color, width } = pencilStroke(pencil, darkSheet)
      return [{ kind: 'ink', geom: { kind: 'stroke', pts }, color, width }]
    },
    hint() {
      return pts ? null : 'Mano alzada: dibuja o escribe libremente con el ratón, el dedo o el lápiz táctil'
    },
  }
}
