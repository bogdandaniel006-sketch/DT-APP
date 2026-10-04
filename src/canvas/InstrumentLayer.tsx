import { memo } from 'react'
import { innerVertices, localVertices } from '../geometry/instruments'
import { mmToPt, ptToMm } from '../geometry/units'
import { toDeg } from '../geometry/vec'
import type { InstrumentKind, InstrumentState, Vec } from '../types'
import { ACCENT } from './style'

const poly = (pts: readonly Vec[]) => `M${pts.map((p) => `${p.x} ${p.y}`).join('L')}Z`

/** Millimetre graduation along the long leg, drawn inside the triangle. */
const Graduation = ({ size, scale, side }: { size: number; scale: number; side: 1 | -1 }) => {
  const mm = mmToPt(1)
  const showMillimetres = mm * scale >= 3
  const count = Math.floor(ptToMm(size) - 6)
  const ticks: string[] = []
  const labels: { x: number; text: string }[] = []
  for (let i = 0; i <= count; i++) {
    const isCm = i % 10 === 0
    const isHalf = i % 5 === 0
    if (!isCm && !isHalf && !showMillimetres) continue
    const len = isCm ? 4 : isHalf ? 2.6 : 1.5
    ticks.push(`M${i * mm} 0V${-len * mm * side}`)
    if (isCm && i > 0) labels.push({ x: i * mm, text: String(i / 10) })
  }
  return (
    <g>
      <path d={ticks.join('')} stroke={ACCENT} strokeOpacity={0.55} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
      {mm * scale >= 1.4 &&
        labels.map((l) => (
          <text
            key={l.x}
            x={l.x}
            y={-6.6 * mm * side + (side < 0 ? 2.5 * mm : 0)}
            fontSize={2.5 * mm}
            textAnchor="middle"
            fill={ACCENT}
            fillOpacity={0.7}
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {l.text}
          </text>
        ))}
    </g>
  )
}

interface Props {
  kind: InstrumentKind
  state: InstrumentState
  scale: number
  active: boolean
}

/** Escuadra / cartabón: a translucent sheet of plastic with a fine blue edge. */
export const InstrumentBody = memo(({ kind, state, scale, active }: Props) => {
  if (!state.visible) return null
  const outer = localVertices(kind, state.size, state.flipped)
  const inner = innerVertices(outer, kind === 'escuadra' ? 0.42 : 0.4)
  return (
    <g
      transform={`translate(${state.pos.x} ${state.pos.y}) rotate(${toDeg(state.rotation)})`}
      className="instrument"
      style={{ opacity: active ? 1 : 0.85 }}
    >
      <path
        d={poly(outer) + poly(inner)}
        fillRule="evenodd"
        fill="rgba(255,255,255,0.58)"
        stroke={ACCENT}
        strokeWidth={active ? 1.1 : 0.9}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <Graduation size={state.size} scale={scale} side={state.flipped ? -1 : 1} />
    </g>
  )
})
InstrumentBody.displayName = 'InstrumentBody'
