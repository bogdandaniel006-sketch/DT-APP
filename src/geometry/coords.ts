import type { Vec, View } from '../types'
import { pageAt, pageOffset, type PageRect } from './layout'

/**
 * The three coordinate systems of the app:
 *
 *   screen   — CSS px inside the workspace. Only used for input and drawing overlays.
 *   desk     — PDF points on the drawing desk, where all sheets lie stacked.
 *   document — PDF points relative to one page (origin top-left, y down).
 *
 * Everything is stored in document coordinates. Zoom and pan only change the
 * `view` used to go between screen and desk, never the geometry itself.
 */

export const screenToDesk = (view: View, s: Vec): Vec => ({ x: (s.x - view.x) / view.scale, y: (s.y - view.y) / view.scale })

export const deskToScreen = (view: View, d: Vec): Vec => ({ x: d.x * view.scale + view.x, y: d.y * view.scale + view.y })

export interface DocumentPoint {
  page: number
  p: Vec
}

export const deskToDocument = (rects: readonly PageRect[], d: Vec): DocumentPoint => {
  const page = pageAt(rects, d)
  const o = pageOffset(rects, page)
  return { page, p: { x: d.x - o.x, y: d.y - o.y } }
}

export const documentToDesk = (rects: readonly PageRect[], page: number, p: Vec): Vec => {
  const o = pageOffset(rects, page)
  return { x: p.x + o.x, y: p.y + o.y }
}

export const screenToDocument = (view: View, rects: readonly PageRect[], s: Vec): DocumentPoint =>
  deskToDocument(rects, screenToDesk(view, s))

export const documentToScreen = (view: View, rects: readonly PageRect[], page: number, p: Vec): Vec =>
  deskToScreen(view, documentToDesk(rects, page, p))
