import { MoveDiagonal2, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AngleMark } from '../geometry/angles'
import { deskToScreen } from '../geometry/coords'
import { snapLabel, type SnapResult } from '../geometry/snapping'
import { add, fromAngle } from '../geometry/vec'
import type { Overlay } from '../tools/types'
import type { Geometry, Vec, View } from '../types'
import { formatAngle } from '../utils/format'
import { geometryPath } from './paths'
import { ACCENT } from './style'

const DANGER = '#EF4444'
const RAY_PX = 6000
const ANGLE_RADIUS_PX = 26

const toScreen = deskToScreen

const geometryToScreen = (v: View, g: Geometry): Geometry => {
  switch (g.kind) {
    case 'segment':
      return { ...g, a: toScreen(v, g.a), b: toScreen(v, g.b) }
    case 'circle':
    case 'arc':
      return { ...g, c: toScreen(v, g.c), r: g.r * v.scale }
    case 'point':
      return { ...g, p: toScreen(v, g.p) }
  }
}

const SnapGlyph = ({ snap, view }: { snap: SnapResult; view: View }) => {
  const { x, y } = toScreen(view, snap.p)
  const s = 5
  const common = { fill: 'white', stroke: ACCENT, strokeWidth: 1.5 }
  let glyph: ReactNode
  switch (snap.kind) {
    case 'endpoint':
      glyph = <rect x={x - s} y={y - s} width={s * 2} height={s * 2} rx={1} {...common} />
      break
    case 'midpoint':
      glyph = <path d={`M${x} ${y - s - 1}L${x + s + 1} ${y + s}L${x - s - 1} ${y + s}Z`} {...common} />
      break
    case 'center':
      glyph = (
        <g>
          <circle cx={x} cy={y} r={s + 0.5} {...common} />
          <circle cx={x} cy={y} r={1.4} fill={ACCENT} />
        </g>
      )
      break
    case 'intersection':
      glyph = (
        <path d={`M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`} stroke={ACCENT} strokeWidth={2} />
      )
      break
    case 'point':
    case 'vertex':
      glyph = <path d={`M${x} ${y - s - 1}L${x + s + 1} ${y}L${x} ${y + s + 1}L${x - s - 1} ${y}Z`} {...common} />
      break
    default:
      glyph = (
        <g>
          <circle cx={x} cy={y} r={3.2} fill="white" stroke={ACCENT} strokeWidth={1.5} />
        </g>
      )
  }
  return (
    <g>
      {glyph}
      {snapLabel(snap) && (
        <text
          x={x + 10}
          y={y + 18}
          fontSize={snap.name ? 12 : 10.5}
          fontWeight={snap.name ? 600 : 400}
          fill={ACCENT}
          fillOpacity={snap.name ? 1 : 0.8}
          className="overlay-text"
          data-testid="snap-label"
        >
          {snapLabel(snap)}
        </text>
      )}
    </g>
  )
}

const AngleArc = ({ mark, view }: { mark: AngleMark; view: View }) => {
  const c = toScreen(view, mark.vertex)
  if (mark.right) {
    const s = 11
    const u = fromAngle(mark.from, s)
    const w = fromAngle(mark.from + mark.sweep, s)
    const p1 = add(c, u)
    const p2 = add(add(c, u), w)
    const p3 = add(c, w)
    return <path d={`M${p1.x} ${p1.y}L${p2.x} ${p2.y}L${p3.x} ${p3.y}`} stroke={ACCENT} strokeWidth={1.25} fill="none" />
  }
  if (mark.value < 1e-3) return null
  const r = ANGLE_RADIUS_PX
  const s = add(c, fromAngle(mark.from, r))
  const e = add(c, fromAngle(mark.from + mark.sweep, r))
  const large = Math.abs(mark.sweep) > Math.PI ? 1 : 0
  return (
    <path
      d={`M${s.x} ${s.y}A${r} ${r} 0 ${large} ${mark.sweep > 0 ? 1 : 0} ${e.x} ${e.y}`}
      stroke={ACCENT}
      strokeWidth={1.25}
      fill="none"
      strokeOpacity={0.85}
    />
  )
}

const angleLabelPosition = (mark: AngleMark, view: View): Vec =>
  add(toScreen(view, mark.vertex), fromAngle(mark.from + mark.sweep / 2, ANGLE_RADIUS_PX + 16))

interface Props {
  overlays: readonly Overlay[]
  view: View
  handles?: { rotate: Vec; resize: Vec } | null
}

/** Screen-space visuals: constant size regardless of zoom. */
export const OverlayLayer = ({ overlays, view, handles }: Props) => {
  const shapes: ReactNode[] = []
  const labels: ReactNode[] = []

  overlays.forEach((o, i) => {
    switch (o.kind) {
      case 'ghost':
        shapes.push(
          <path
            key={i}
            d={geometryPath(geometryToScreen(view, o.geom), 3)}
            stroke={ACCENT}
            strokeWidth={o.faint ? 1 : 1.4}
            strokeOpacity={o.faint ? 0.35 : 0.95}
            strokeDasharray={o.faint ? '4 4' : undefined}
            fill={o.geom.kind === 'point' ? ACCENT : 'none'}
            strokeLinecap="round"
          />,
        )
        break
      case 'highlight':
        shapes.push(
          <path
            key={i}
            d={geometryPath(geometryToScreen(view, o.geom), 4)}
            stroke={o.tone === 'danger' ? DANGER : ACCENT}
            strokeWidth={o.tone === 'danger' ? 3 : 2.5}
            strokeOpacity={o.tone === 'danger' ? 0.55 : 0.35}
            fill="none"
            strokeLinecap="round"
          />,
        )
        break
      case 'guide': {
        const a = toScreen(view, o.a)
        const b = toScreen(view, o.b)
        shapes.push(
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACCENT} strokeOpacity={0.5} strokeDasharray="4 4" />,
        )
        break
      }
      case 'ray': {
        const c = toScreen(view, o.origin)
        const a = add(c, fromAngle(o.dir, RAY_PX))
        const b = add(c, fromAngle(o.dir, -RAY_PX))
        shapes.push(
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ACCENT} strokeOpacity={0.28} strokeDasharray="2 5" />,
        )
        break
      }
      case 'marker': {
        const p = toScreen(view, o.p)
        shapes.push(
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={o.handle ? 4.5 : 3}
              fill="white"
              stroke={ACCENT}
              strokeWidth={1.5}
              className={o.handle ? 'handle' : undefined}
            />
            {o.label && (
              <text x={p.x - 9} y={p.y - 9} fontSize={11.5} fontWeight={600} fill={ACCENT} textAnchor="end" className="overlay-text">
                {o.label}
              </text>
            )}
          </g>,
        )
        break
      }
      case 'label': {
        const p = add(toScreen(view, o.at), o.offset ?? { x: 0, y: 0 })
        labels.push(
          <div key={i} className="measure-pill" style={{ left: p.x, top: p.y }}>
            {o.text}
          </div>,
        )
        break
      }
      case 'angle': {
        shapes.push(<AngleArc key={i} mark={o.mark} view={view} />)
        if (o.showValue && o.mark.value > 1e-3) {
          const p = angleLabelPosition(o.mark, view)
          labels.push(
            <div key={i} className="angle-tag" style={{ left: p.x, top: p.y }}>
              {o.text ?? formatAngle(o.mark.value)}
            </div>,
          )
        }
        break
      }
      case 'snap':
        shapes.push(<SnapGlyph key={i} snap={o.snap} view={view} />)
        break
      case 'marquee': {
        const a = toScreen(view, o.a)
        const b = toScreen(view, o.b)
        shapes.push(
          <rect
            key={i}
            x={Math.min(a.x, b.x)}
            y={Math.min(a.y, b.y)}
            width={Math.abs(a.x - b.x)}
            height={Math.abs(a.y - b.y)}
            fill={ACCENT}
            fillOpacity={0.05}
            stroke={ACCENT}
            strokeOpacity={0.6}
            strokeDasharray="4 3"
            rx={2}
          />,
        )
      }
    }
  })

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">{shapes}</svg>
      <div className="pointer-events-none absolute inset-0">
        {labels}
        {handles && (
          <>
            <div className="instrument-handle" style={{ left: toScreen(view, handles.rotate).x, top: toScreen(view, handles.rotate).y }}>
              <RotateCw size={13} strokeWidth={2.2} />
            </div>
            <div className="instrument-handle" style={{ left: toScreen(view, handles.resize).x, top: toScreen(view, handles.resize).y }}>
              <MoveDiagonal2 size={13} strokeWidth={2.2} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
