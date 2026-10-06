import { memo } from 'react'
import { mmToPt } from '../geometry/units'
import type { Geometry, GeometryShape, Vec } from '../types'
import { geometryPath } from './paths'
import { MIN_NAME_PX, NAME_SIZE, nameReach, placeName } from './pointLabel'
import { ACCENT, LAYER_OPACITY, pencilStroke } from './style'

/** Strokes never get thinner than this on screen, so zoomed-out drawings stay legible. */
const MIN_SCREEN_WIDTH = 0.75
const POINT_RADIUS = mmToPt(0.5)

interface Props {
  shapes: readonly GeometryShape[]
  /** Strokes (drawn or of the PDF) around a point, which its name should not cover. */
  strokesNear: (p: Vec, r: number) => readonly Geometry[]
  selection: ReadonlySet<string>
  scale: number
}

export const ShapesLayer = memo(({ shapes, strokesNear, selection, scale }: Props) => (
  <g strokeLinecap="round" strokeLinejoin="round" fill="none">
    {shapes.map((s) => {
      const { color, width, dash } = pencilStroke(s.pencil)
      const selected = selection.has(s.id)
      const stroke = selected ? ACCENT : color
      const opacity = selected ? 1 : LAYER_OPACITY[s.layer]
      if (s.kind === 'point') {
        // Letters as on paper, never smaller than legible on screen, set where they cover the fewest strokes.
        const size = Math.max(NAME_SIZE, MIN_NAME_PX / scale)
        const at = s.name ? placeName(s.p, s.name, size, strokesNear(s.p, nameReach(s.name, size))) : null
        return (
          <g key={s.id} opacity={opacity}>
            <path d={geometryPath(s, Math.max(POINT_RADIUS, 1.6 / scale))} fill={stroke} />
            {s.name && at && (
              <text
                x={at.x}
                y={at.y}
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
          strokeDasharray={dash?.join(' ')}
          opacity={opacity}
        />
      )
    })}
  </g>
))
ShapesLayer.displayName = 'ShapesLayer'
