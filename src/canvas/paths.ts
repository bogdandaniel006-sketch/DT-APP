import { arcEndPoint, arcStartPoint } from '../geometry/primitives'
import type { Geometry } from '../types'

const n = (v: number) => Math.round(v * 1000) / 1000

/** SVG path data for a geometry in world coordinates (also usable with Path2D). */
export const geometryPath = (g: Geometry, pointRadius = 1.2): string => {
  switch (g.kind) {
    case 'segment':
      return `M${n(g.a.x)} ${n(g.a.y)}L${n(g.b.x)} ${n(g.b.y)}`
    case 'circle':
    case 'point': {
      const c = g.kind === 'circle' ? g.c : g.p
      const r = g.kind === 'circle' ? g.r : pointRadius
      return `M${n(c.x - r)} ${n(c.y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`
    }
    case 'arc': {
      const s = arcStartPoint(g)
      const e = arcEndPoint(g)
      const large = Math.abs(g.sweep) > Math.PI ? 1 : 0
      const sweep = g.sweep > 0 ? 1 : 0
      return `M${n(s.x)} ${n(s.y)}A${n(g.r)} ${n(g.r)} 0 ${large} ${sweep} ${n(e.x)} ${n(e.y)}`
    }
  }
}
