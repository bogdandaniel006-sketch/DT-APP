import { documentActions } from '../state/documentStore'
import { appStore } from '../state/appStore'
import type { Shape } from '../types'
import type { Tool } from './types'
import { outlineOf } from '../geometry/shapes'

/** Click a stroke to erase it, or drag across several. Each drag is one undo step. */
export const createEraserTool = (): Tool => {
  let erasing = false
  let hover: Shape | null = null

  const erase = (s: Shape | null) => {
    if (!s) return
    documentActions.remove([s.id])
    const { selection } = appStore.get()
    if (selection.includes(s.id)) appStore.set({ selection: selection.filter((id) => id !== s.id) })
  }

  return {
    down(e, api) {
      erasing = true
      documentActions.beginGesture()
      erase(api.hit(e.world))
      hover = null
    },
    move(e, api) {
      const hit = api.hit(e.world)
      if (erasing) erase(hit)
      else hover = hit
    },
    up() {
      if (erasing) documentActions.endGesture()
      erasing = false
    },
    cancel() {
      return false
    },
    overlays() {
      return hover ? outlineOf(hover).map((geom) => ({ kind: 'highlight' as const, geom, tone: 'danger' as const })) : []
    },
    hint() {
      return 'Clic sobre un trazo para borrarlo · arrastra para borrar varios'
    },
  }
}
