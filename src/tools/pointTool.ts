import { distance } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import { sub } from '../geometry/vec'
import { suggestName } from '../pdf/detect'
import { appStore } from '../state/appStore'
import type { Vec } from '../types'
import { snapOverlay } from './overlays'
import type { Overlay, Tool, ToolApi } from './types'

/** Points closer than this (px) to an existing one select it instead of creating a duplicate. */
const SAME_POINT_PX = 6

/**
 * Punto: click to create a named point (A, B, C… or the label printed next to
 * a PDF point). Clicking an existing point opens its name for editing.
 */
export const createPointTool = (): Tool => {
  let cursor: Vec | null = null
  let snap: SnapResult | null = null

  const existingAt = (p: Vec, api: ToolApi) => {
    const hit = api.hit(p, (s) => s.kind === 'point')
    return hit?.kind === 'point' && distance(hit.p, p) <= api.px(SAME_POINT_PX) ? hit : null
  }

  /** Name for a new point: the exercise's own label when there is one, else the next free letter. */
  const nameFor = (p: Vec, api: ToolApi) => {
    const fallback = api.nextPointName(p)
    if (snap?.source !== 'pdf') return fallback
    const page = api.pageAt(p)
    const label = suggestName(page, sub(p, api.pageOffset(page)))
    const taken = api.shapes.some((s) => s.page === page && s.name === label)
    return label && !taken ? label : fallback
  }

  return {
    down(e, api) {
      snap = api.snap(e.world)
      const p = snap.p
      const existing = existingAt(p, api)
      if (existing && existing.kind === 'point') {
        appStore.set({ naming: { p: existing.p, id: existing.id, value: existing.name ?? '' } })
        return
      }
      api.create([{ kind: 'point', p, name: nameFor(p, api) }])
    },
    move(e, api) {
      snap = api.snap(e.world)
      cursor = snap.p
    },
    up() {},
    cancel() {
      return false
    },
    overlays(api) {
      if (!cursor) return []
      const out: Overlay[] = []
      const existing = existingAt(cursor, api)
      if (!existing) out.push({ kind: 'marker', p: cursor, label: nameFor(cursor, api) })
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      return 'Clic para crear un punto con nombre · clic sobre un punto para renombrarlo'
    },
  }
}
