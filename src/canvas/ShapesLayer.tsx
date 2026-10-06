import { memo } from 'react'
import { LINE_HEIGHT, textLines, textSize } from '../geometry/text'
import { mmToPt } from '../geometry/units'
import type { Geometry, GeometryShape, Vec } from '../types'
import { ARROW_LENGTH, DIMENSION_SIZE, DIMENSION_WIDTH, dimensionFigure, dimensionParts } from './dimension'
import { geometryPath } from './paths'
import { MIN_NAME_PX, NAME_SIZE, nameAnchor, nameReach, placeName } from './pointLabel'
import { ACCENT, LAYER_OPACITY, pencilStroke } from './style'

/** Strokes never get thinner than this on screen, so zoomed-out drawings stay legible. */
const MIN_SCREEN_WIDTH = 0.75
const POINT_RADIUS = mmToPt(0.5)
/** Arrowheads of dimensions never get shorter than this on screen. */
const MIN_ARROW_PX = 9

interface Props {
  shapes: readonly GeometryShape[]
  /** Strokes (drawn or of the PDF) around a point, which its name should not cover. */
  strokesNear: (p: Vec, r: number) => readonly Geometry[]
  selection: ReadonlySet<string>
  /** Text being rewritten in its box, which is not drawn meanwhile. */
  editingId?: string
  scale: number
}

/** Letters on the desk: a white edge keeps them readable over whatever lies beneath. */
const Letters = ({ at, size, fill, children }: { at: Vec; size: number; fill: string; children: string }) => (
  <text
    x={at.x}
    y={at.y}
    fontSize={size}
    fill={fill}
    stroke="white"
    strokeWidth={size * 0.18}
    paintOrder="stroke"
    className="point-name"
    data-point-name={children}
  >
    {children}
  </text>
)

export const ShapesLayer = memo(({ shapes, strokesNear, selection, editingId, scale }: Props) => (
  <g strokeLinecap="round" strokeLinejoin="round" fill="none">
    {shapes.map((s) => {
      const { color, width, dash } = pencilStroke(s.pencil)
      const selected = selection.has(s.id)
      const stroke = selected ? ACCENT : color
      const opacity = selected ? 1 : LAYER_OPACITY[s.layer]
      // Names as on paper, never smaller than legible on screen, set where they cover the fewest strokes.
      const nameSize = Math.max(NAME_SIZE, MIN_NAME_PX / scale)
      const nameAt = (anchor: Vec, name: string) => placeName(anchor, name, nameSize, strokesNear(anchor, nameReach(name, nameSize)))

      if (s.kind === 'point' && s.text) {
        // While a text is being rewritten its box shows it; drawing it too would double the letters.
        if (s.id === editingId) return null
        // Written text: no dot, it starts exactly where it was put, at its true size, line under line.
        const size = textSize(s.size)
        return (
          <text
            key={s.id}
            opacity={opacity}
            x={s.p.x}
            y={s.p.y}
            fontSize={size}
            fill={stroke}
            stroke="white"
            strokeWidth={size * 0.12}
            paintOrder="stroke"
            className="point-name"
            style={{ whiteSpace: 'pre' }}
          >
            {textLines(s.name ?? '').map((line, i) => (
              <tspan key={i} x={s.p.x} dy={i ? size * LINE_HEIGHT : 0}>
                {line || ' '}
              </tspan>
            ))}
          </text>
        )
      }
      if (s.kind === 'point') {
        return (
          <g key={s.id} opacity={opacity}>
            <path d={geometryPath(s, Math.max(POINT_RADIUS, 1.6 / scale))} fill={stroke} />
            {s.name && (
              <Letters at={nameAt(s.p, s.name)} size={nameSize} fill={stroke}>
                {s.name}
              </Letters>
            )}
          </g>
        )
      }
      if (s.kind === 'segment' && s.dimension) {
        // A dimension: arrowheads at both ends and its figure written along the line, above it.
        const figureSize = DIMENSION_SIZE
        const { arrows, tails, figureAt, angle } = dimensionParts(s.a, s.b, figureSize, Math.max(ARROW_LENGTH, MIN_ARROW_PX / scale))
        return (
          <g key={s.id} opacity={opacity}>
            {/* Always the thin continuous line of the standard, whatever pencil it was drawn with. */}
            <path
              d={geometryPath(s) + tails.map(([from, to]) => `M${from.x} ${from.y}L${to.x} ${to.y}`).join("")}
              stroke={stroke}
              strokeWidth={Math.max(DIMENSION_WIDTH, MIN_SCREEN_WIDTH / scale)}
            />
            {arrows.map(([tip, left, right], i) => (
              <path key={i} d={`M${tip.x} ${tip.y}L${left.x} ${left.y}L${right.x} ${right.y}Z`} fill={stroke} />
            ))}
            <text
              x={figureAt.x}
              y={figureAt.y}
              fontSize={figureSize}
              textAnchor="middle"
              transform={`rotate(${(angle * 180) / Math.PI} ${figureAt.x} ${figureAt.y})`}
              fill={stroke}
              stroke="white"
              strokeWidth={figureSize * 0.18}
              paintOrder="stroke"
              className="point-name"
            >
              {s.name ?? dimensionFigure(s.a, s.b)}
            </text>
          </g>
        )
      }
      return (
        <g key={s.id} opacity={opacity}>
          <path
            d={geometryPath(s)}
            stroke={stroke}
            strokeWidth={Math.max(width, MIN_SCREEN_WIDTH / scale) * (selected ? 1.15 : 1)}
            strokeDasharray={dash?.join(' ')}
          />
          {s.name && (
            <Letters at={nameAt(nameAnchor(s), s.name)} size={nameSize} fill={stroke}>
              {s.name}
            </Letters>
          )}
        </g>
      )
    })}
  </g>
))
ShapesLayer.displayName = 'ShapesLayer'
