import { distance } from '../geometry/primitives'
import { mmToPt, ptToMm } from '../geometry/units'
import type { Vec } from '../types'

/**
 * Dimension lines (cotas), drawn as the standard for technical drawing asks (UNE 1039 / ISO 129,
 * the one followed in Bachillerato):
 *
 * - a thin continuous line with a narrow filled arrowhead at each end, touching the extension lines;
 * - the figure centred on the line and clear of it, written along it: above a horizontal
 *   dimension, to the left of a vertical one and read from the right of the sheet (bottom to
 *   top), and for the slanted ones on the side that keeps it readable from below or from the right;
 * - all figures the same height, in millimetres and without the unit;
 * - when the dimension is too short to hold its arrowheads, they go outside, pointing inwards.
 *
 * A dimension is stored as a segment marked `dimension`. The figure is the measured length
 * unless the segment carries a name, which then replaces it.
 */

/** Height of the figure, as on paper. It is the same for every dimension and at every zoom: it grows and shrinks with the drawing. */
export const DIMENSION_SIZE = mmToPt(1.8)
/** Length of an arrowhead, as on paper; it is a narrow filled triangle. */
export const ARROW_LENGTH = mmToPt(3)
/** Width of dimension lines: the thin line of the standard, whatever pencil is in hand. */
export const DIMENSION_WIDTH = mmToPt(0.25)
/** Half the width of an arrowhead, as a fraction of its length (about 15° in all). */
const ARROW_HALF_WIDTH = 0.14
/** Clear space between the line and its figure, as a fraction of the figure's height. */
const FIGURE_GAP = 0.35
/** A dimension shorter than this many arrowheads has them outside. */
const INSIDE_ARROWS = 3
/** How far the line reaches beyond an outside arrowhead, in arrowhead lengths. */
const OUTSIDE_TAIL = 1.6
/**
 * Steepest a figure is written running downwards (radians). Past it — a vertical line, or one
 * leaning a little either way — it is written upwards instead, to the left of the line, so a
 * line that is vertical but for a hair never throws its figure to the other side.
 */
const STEEPEST_DOWN = Math.PI / 3

/** The length as written on a drawing: millimetres, no unit, a decimal only when there is one. */
export const dimensionFigure = (a: Vec, b: Vec): string => {
  const mm = Math.round(ptToMm(distance(a, b)) * 10) / 10
  return Number.isInteger(mm) ? String(mm) : mm.toFixed(1).replace('.', ',')
}

export interface DimensionParts {
  /** The two arrowheads, each as tip and the two corners of its base. */
  arrows: [Vec, Vec, Vec][]
  /** Pieces of line beyond the ends, when the arrowheads are outside. */
  tails: [Vec, Vec][]
  /** Middle of the figure's baseline. */
  figureAt: Vec
  /** Direction the figure is written in (radians, y down). */
  angle: number
}

/** Where the arrowheads and the figure of the dimension a→b go, for letters and arrows of the given sizes. */
export const dimensionParts = (a: Vec, b: Vec, figureSize = DIMENSION_SIZE, arrowLength = ARROW_LENGTH): DimensionParts => {
  const length = distance(a, b)
  const u = length > 1e-9 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 }
  const n = { x: -u.y, y: u.x }
  const outside = length < arrowLength * INSIDE_ARROWS
  const w = arrowLength * ARROW_HALF_WIDTH
  /** An arrowhead with its tip at `tip`, its base `dir` (±1) along the line from it. */
  const head = (tip: Vec, dir: number): [Vec, Vec, Vec] => {
    const base = { x: tip.x + u.x * arrowLength * dir, y: tip.y + u.y * arrowLength * dir }
    return [tip, { x: base.x + n.x * w, y: base.y + n.y * w }, { x: base.x - n.x * w, y: base.y - n.y * w }]
  }
  const tail = (from: Vec, dir: number): [Vec, Vec] => [
    from,
    { x: from.x + u.x * arrowLength * OUTSIDE_TAIL * dir, y: from.y + u.y * arrowLength * OUTSIDE_TAIL * dir },
  ]

  let angle = Math.atan2(u.y, u.x)
  if (angle > STEEPEST_DOWN) angle -= Math.PI
  else if (angle <= STEEPEST_DOWN - Math.PI) angle += Math.PI
  // The side that is "above" the writing: over a horizontal figure, to the left of a vertical one.
  const up = { x: Math.sin(angle), y: -Math.cos(angle) }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const gap = figureSize * FIGURE_GAP
  return {
    arrows: outside ? [head(a, -1), head(b, 1)] : [head(a, 1), head(b, -1)],
    tails: outside ? [tail(a, -1), tail(b, 1)] : [],
    figureAt: { x: mid.x + up.x * gap, y: mid.y + up.y * gap },
    angle,
  }
}
