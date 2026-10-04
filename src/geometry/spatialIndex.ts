import type { Vec } from '../types'
import type { Bounds } from './shapes'

/**
 * Uniform grid over item bounds: snapping asks only for what lies near the
 * cursor instead of scanning thousands of detected PDF elements.
 */
export class SpatialIndex<T> {
  private cells = new Map<string, T[]>()

  constructor(private readonly cellSize = 24) {}

  private key(ix: number, iy: number) {
    return `${ix},${iy}`
  }

  insert(item: T, b: Bounds) {
    const s = this.cellSize
    const x0 = Math.floor(b.minX / s)
    const x1 = Math.floor(b.maxX / s)
    const y0 = Math.floor(b.minY / s)
    const y1 = Math.floor(b.maxY / s)
    // Huge items (long lines, big circles) would fill too many cells: register along their extent anyway,
    // the grid stays sparse because the page itself is bounded.
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const k = this.key(ix, iy)
        const cell = this.cells.get(k)
        if (cell) cell.push(item)
        else this.cells.set(k, [item])
      }
    }
  }

  /** Items whose bounds touch the square of half-size r around p (deduplicated). */
  query(p: Vec, r: number): T[] {
    const s = this.cellSize
    const out = new Set<T>()
    for (let ix = Math.floor((p.x - r) / s); ix <= Math.floor((p.x + r) / s); ix++) {
      for (let iy = Math.floor((p.y - r) / s); iy <= Math.floor((p.y + r) / s); iy++) {
        const cell = this.cells.get(this.key(ix, iy))
        if (cell) for (const item of cell) out.add(item)
      }
    }
    return [...out]
  }
}
