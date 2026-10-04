import type { Vec } from '../types'
import { mmToPt } from './units'

/**
 * All pages lie on the desk, stacked vertically and centred. Desk coordinates
 * are what tools and instruments use; shapes are stored relative to their page
 * (PDF points), so exports and storage never depend on the layout.
 */
export interface PageRect {
  x: number
  y: number
  w: number
  h: number
}

export const PAGE_GAP = mmToPt(12)

export const layoutPages = (sizes: readonly { w: number; h: number }[]): PageRect[] => {
  const maxW = Math.max(0, ...sizes.map((s) => s.w))
  let y = 0
  return sizes.map((s) => {
    const rect = { x: (maxW - s.w) / 2, y, w: s.w, h: s.h }
    y += s.h + PAGE_GAP
    return rect
  })
}

export const pageOffset = (rects: readonly PageRect[], page: number): Vec => {
  const r = rects[page]
  return r ? { x: r.x, y: r.y } : { x: 0, y: 0 }
}

/** Page containing p, or the nearest one when p lies between or beside pages. */
export const pageAt = (rects: readonly PageRect[], p: Vec): number => {
  let best = 0
  let bestDist = Infinity
  rects.forEach((r, i) => {
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
    const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
    const d = Math.hypot(dx, dy)
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  })
  return best
}
