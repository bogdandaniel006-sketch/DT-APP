import { memo, type ReactNode } from 'react'
import { vertexAngle } from '../geometry/angles'
import { deskToScreen } from '../geometry/coords'
import { distance } from '../geometry/primitives'
import { add, fromAngle, normalize, perp, scale, sub, wrapAngle } from '../geometry/vec'
import { isMeasure, type Shape, type Vec, type View } from '../types'
import { formatAngle, formatPrecise } from '../utils/format'
import { ACCENT } from './style'

const ARC_PX = 30
const TICK_PX = 5

/** Name of the drawn point lying exactly at p, if any. */
export const pointNameAt = (named: readonly Shape[], p: Vec): string | undefined =>
  named.find((s) => s.kind === 'point' && s.name && distance(s.p, p) < 1e-6)?.name

interface Props {
  shapes: readonly Shape[]
  /** Drawn shapes, to read the names of the measured points. */
  named: readonly Shape[]
  selection: ReadonlySet<string>
  view: View
}

/**
 * Distances and angles measured by the user: an annotation layer of its own,
 * drawn at screen size so labels stay readable at any zoom.
 */
export const MeasuresLayer = memo(({ shapes, named, selection, view }: Props) => {
  const strokes: ReactNode[] = []
  const labels: ReactNode[] = []
  for (const m of shapes) {
    if (!isMeasure(m)) continue
    const selected = selection.has(m.id)
    const opacity = selected ? 1 : 0.8
    if (m.kind === 'distance') {
      const a = deskToScreen(view, m.a)
      const b = deskToScreen(view, m.b)
      const n = scale(normalize(perp(sub(b, a))), TICK_PX)
      const names = [pointNameAt(named, m.a), pointNameAt(named, m.b)]
      const value = formatPrecise(distance(m.a, m.b))
      const text = names[0] && names[1] ? `${names[0]}${names[1]} = ${value}` : value
      strokes.push(
        <g key={m.id} stroke={ACCENT} strokeOpacity={opacity} strokeWidth={selected ? 1.6 : 1.1} fill="none">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          <line x1={a.x - n.x} y1={a.y - n.y} x2={a.x + n.x} y2={a.y + n.y} />
          <line x1={b.x - n.x} y1={b.y - n.y} x2={b.x + n.x} y2={b.y + n.y} />
        </g>,
      )
      const side = n.y > 0 ? scale(n, -3.6) : scale(n, 3.6)
      const mid = add(scale(add(a, b), 0.5), side)
      labels.push(
        <div key={m.id} className={`measure-pill ${selected ? 'is-selected' : ''}`} style={{ left: mid.x, top: mid.y }} data-measure="distance">
          {text}
        </div>,
      )
    } else {
      const a = deskToScreen(view, m.a)
      const b = deskToScreen(view, m.b)
      const c = deskToScreen(view, m.c)
      const from = Math.atan2(a.y - b.y, a.x - b.x)
      const sweep = wrapAngle(Math.atan2(c.y - b.y, c.x - b.x) - from)
      const s = add(b, fromAngle(from, ARC_PX))
      const e = add(b, fromAngle(from + sweep, ARC_PX))
      strokes.push(
        <g key={m.id} stroke={ACCENT} strokeOpacity={opacity} fill="none" strokeWidth={selected ? 1.6 : 1.1}>
          <line x1={b.x} y1={b.y} x2={a.x} y2={a.y} strokeDasharray="3 3" strokeOpacity={opacity * 0.6} />
          <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} strokeDasharray="3 3" strokeOpacity={opacity * 0.6} />
          <path d={`M${s.x} ${s.y}A${ARC_PX} ${ARC_PX} 0 0 ${sweep > 0 ? 1 : 0} ${e.x} ${e.y}`} />
        </g>,
      )
      const names = [pointNameAt(named, m.a), pointNameAt(named, m.b), pointNameAt(named, m.c)]
      const value = formatAngle(vertexAngle(m.a, m.b, m.c))
      const text = names.every(Boolean) ? `∠${names.join('')} = ${value}` : value
      const at = add(b, fromAngle(from + sweep / 2, ARC_PX + 22))
      labels.push(
        <div key={m.id} className={`measure-pill ${selected ? 'is-selected' : ''}`} style={{ left: at.x, top: at.y }} data-measure="angle">
          {text}
        </div>,
      )
    }
  }
  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">{strokes}</svg>
      <div className="pointer-events-none absolute inset-0">{labels}</div>
    </>
  )
})
MeasuresLayer.displayName = 'MeasuresLayer'
