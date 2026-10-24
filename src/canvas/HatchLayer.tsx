import { memo } from 'react'
import { mmToPt } from '../geometry/units'
import type { HatchShape } from '../types'
import { ACCENT, LAYER_OPACITY, pencilStroke } from './style'

/** Section lining is always the thin continuous line of the standard, whatever pencil drew it. */
export const HATCH_WIDTH = mmToPt(0.25)
/** Never thinner than this on screen, so zoomed-out linings stay visible. */
const MIN_SCREEN_WIDTH = 0.6

/** The pattern of one lining as an SVG path. */
export const hatchPath = (h: HatchShape) => h.lines.map(([a, b]) => `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`).join('')

/** Linings, under the strokes so that the outlines stay on top of them. */
export const HatchLayer = memo(({ hatches, selection, scale }: { hatches: readonly HatchShape[]; selection: ReadonlySet<string>; scale: number }) => (
  <g fill="none" strokeLinecap="butt">
    {hatches.map((h) => {
      const selected = selection.has(h.id)
      return (
        <path
          key={h.id}
          d={hatchPath(h)}
          stroke={selected ? ACCENT : pencilStroke(h.pencil).color}
          strokeWidth={Math.max(HATCH_WIDTH, MIN_SCREEN_WIDTH / scale)}
          opacity={selected ? 1 : LAYER_OPACITY[h.layer]}
        />
      )
    })}
  </g>
))
HatchLayer.displayName = 'HatchLayer'
