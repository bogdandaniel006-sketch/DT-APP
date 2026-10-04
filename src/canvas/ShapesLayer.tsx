import { memo } from 'react'
import { mmToPt } from '../geometry/units'
import type { GeometryShape } from '../types'
import { geometryPath } from './paths'
import { ACCENT, LAYER_OPACITY, pencilStroke } from './style'

/** Strokes never get thinner than this on screen, so zoomed-out drawings stay legible. */
const MIN_SCREEN_WIDTH = 0.75
const POINT_RADIUS = mmToPt(0.5)
const NAME_SIZE = mmToPt(3.2)

interface Props {
  shapes: readonly GeometryShape[]
  selection: ReadonlySet<string>
  scale: number
}

export const ShapesLayer = memo(({ shapes, selection, scale }: Props) => (
  <g strokeLinecap="round" strokeLinejoin="round" fill="none">
    {shapes.map((s) => {
      const { color, width } = pencilStroke(s.pencil)
      const selected = selection.has(s.id)
      const stroke = selected ? ACCENT : color
      const opacity = selected ? 1 : LAYER_OPACITY[s.layer]
      if (s.kind === 'point') {
        // Letters as on paper (about 3 mm), never smaller than legible on screen.
        const size = Math.max(NAME_SIZE, 11 / scale)
        return (
          <g key={s.id} opacity={opacity}>
            <path d={geometryPath(s, Math.max(POINT_RADIUS, 1.6 / scale))} fill={stroke} />
            {s.name && (
              <text
                x={s.p.x + size * 0.35}
                y={s.p.y - size * 0.35}
                fontSize={size}
                fill={stroke}
                stroke="white"
                strokeWidth={size * 0.18}
                paintOrder="stroke"
                className="point-name"
                data-point-name={s.name}
              >
                {s.name}
              </text>
            )}
          </g>
        )
      }
      return (
        <path
          key={s.id}
          d={geometryPath(s)}
          stroke={stroke}
          strokeWidth={Math.max(width, MIN_SCREEN_WIDTH / scale) * (selected ? 1.15 : 1)}
          opacity={opacity}
        />
      )
    })}
  </g>
))
ShapesLayer.displayName = 'ShapesLayer'
