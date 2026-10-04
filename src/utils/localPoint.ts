import type { Vec } from '../types'

/**
 * Converts a pointer position (client px) to px inside `el`, correct even when
 * an ancestor is scaled (the visual-zoom compensation on #root).
 */
export const localPoint = (el: Element, clientX: number, clientY: number): Vec => {
  const rect = el.getBoundingClientRect()
  const k = rect.width > 0 ? (el as HTMLElement).offsetWidth / rect.width : 1
  return { x: (clientX - rect.left) * k, y: (clientY - rect.top) * k }
}
