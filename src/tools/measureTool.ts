import { angleMark, vertexAngle } from '../geometry/angles'
import { distance } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import type { Vec } from '../types'
import { formatAngle, formatPrecise } from '../utils/format'
import { snapOverlay } from './overlays'
import type { Overlay, Tool } from './types'

interface Picked {
  p: Vec
  name?: string
}

/**
 * Medir distancia (A → B) and Medir ángulo (A → vertex B → C). Each click snaps
 * to points, intersections and PDF geometry; the result is kept as a measure.
 */
export const createMeasureTool = (mode: 'distance' | 'angle'): Tool => {
  let picked: Picked[] = []
  let cursor: Picked | null = null
  let snap: SnapResult | null = null
  const needed = mode === 'distance' ? 2 : 3

  const label = (pts: readonly Picked[]) => {
    if (mode === 'distance') {
      const [a, b] = pts as [Picked, Picked]
      const value = formatPrecise(distance(a.p, b.p))
      return a.name && b.name ? `${a.name}${b.name} = ${value}` : value
    }
    const [a, b, c] = pts as [Picked, Picked, Picked]
    const value = formatAngle(vertexAngle(a.p, b.p, c.p))
    return a.name && b.name && c.name ? `∠${a.name}${b.name}${c.name} = ${value}` : value
  }

  return {
    down(e, api) {
      snap = api.snap(e.world)
      const p: Picked = { p: snap.p, name: snap.name }
      const last = picked[picked.length - 1]
      if (last && distance(last.p, p.p) < api.px(2)) return
      picked = [...picked, p]
      if (picked.length < needed) return
      const [a, b, c] = picked as [Picked, Picked, Picked]
      api.create([mode === 'distance' ? { kind: 'distance', a: a.p, b: b.p } : { kind: 'angle', a: a.p, b: b.p, c: c.p }])
      picked = []
    },
    move(e, api) {
      snap = api.snap(e.world)
      cursor = { p: snap.p, name: snap.name }
    },
    up() {},
    cancel() {
      const had = picked.length > 0
      picked = []
      return had
    },
    overlays() {
      const out: Overlay[] = []
      const pts = cursor ? [...picked, cursor] : picked
      const names = mode === 'distance' ? ['A', 'B'] : ['A', 'B', 'C']
      pts.forEach((q, i) => out.push({ kind: 'marker', p: q.p, label: q.name ?? names[i] }))
      if (mode === 'distance' && pts.length === 2) {
        const [a, b] = pts as [Picked, Picked]
        out.push({ kind: 'guide', a: a.p, b: b.p })
        out.push({ kind: 'label', at: { x: (a.p.x + b.p.x) / 2, y: (a.p.y + b.p.y) / 2 }, text: label(pts), offset: { x: 0, y: -18 } })
      }
      if (mode === 'angle' && pts.length >= 2) {
        const [a, b] = pts as [Picked, Picked]
        out.push({ kind: 'guide', a: b.p, b: a.p })
        if (pts.length === 3) {
          const c = pts[2]!
          out.push({ kind: 'guide', a: b.p, b: c.p })
          const mark = angleMark(b.p, Math.atan2(a.p.y - b.p.y, a.p.x - b.p.x), Math.atan2(c.p.y - b.p.y, c.p.x - b.p.x))
          out.push({ kind: 'angle', mark: { ...mark, right: false }, showValue: true, text: label(pts) })
        }
      }
      return [...out, ...snapOverlay(snap)]
    },
    hint() {
      if (mode === 'distance') return picked.length ? 'Clic en el segundo punto (B)' : 'Medir distancia: clic en el primer punto (A)'
      return ['Medir ángulo: clic en un punto del primer lado (A)', 'Clic en el vértice (B)', 'Clic en un punto del segundo lado (C)'][picked.length]!
    },
  }
}
