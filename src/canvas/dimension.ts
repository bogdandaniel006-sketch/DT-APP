import { distance } from '../geometry/primitives'
import { mmToPt, ptToMm } from '../geometry/units'
import type { Vec } from '../types'

/**
 * Dimension lines (cotas). A dimension is stored as a segment marked `dimension`: it is drawn
 * with an arrowhead at each end and its figure centred above it, written along the line.
 * The figure is the measured length unless the segment carries a name, which then replaces it.
 */

/** Height of the figure, as on paper. */
export const DIMENSION_SIZE = mmToPt(3)
/** On screen the figure never gets smaller than this. */
export const MIN_DIMENSION_PX = 10
/** Length of an arrowhead, as on paper; it is a narrow filled triangle. */
export const ARROW_LENGTH = mmToPt(3)
/** Half the width of an arrowhead, as a fraction of its length (about 15° in all). */
const ARROW_HALF_WIDTH = 0.14
/** Clear space between the line and its figure, as a fraction of the figure's height. */
const FIGURE_GAP = 0.35

/** The length as written on a drawing: millimetres, no unit, a decimal only when there is one. */
export const dimensionFigure = (a: Vec, b: Vec): string => {
  const mm = Math.round(ptToMm(distance(a, b)) * 10) / 10
  return Number.isInteger(mm) ? String(mm) : mm.toFixed(1).replace('.', ',')
}

export interface DimensionParts {
  /** The two arrowheads, each as tip and the two corners of its base. */
  arrows: [Vec, Vec, Vec][]
  /** Middle of the figure's baseline. */
  figureAt: Vec
  /** Direction the figure is written in (radians, y down), always readable left to right. */
  angle: number
}

/** Where the arrowheads and the figure of the dimension a→b go, for letters and arrows of the given sizes. */
export const dimensionParts = (a: Vec, b: Vec, figureSize = DIMENSION_SIZE, arrowLength = ARROW_LENGTH): DimensionParts => {
  const length = distance(a, b)
  const u = length > 1e-9 ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length } : { x: 1, y: 0 }
  const n = { x: -u.y, y: u.x }
  // Arrowheads never take more than a third of a short dimension each.
  const l = Math.min(arrowLength, length / 3)
  const w = l * ARROW_HALF_WIDTH
  const head = (tip: Vec, dir: number): [Vec, Vec, Vec] => {
    const base = { x: tip.x + u.x * l * dir, y: tip.y + u.y * l * dir }
    return [tip, { x: base.x + n.x * w, y: base.y + n.y * w }, { x: base.x - n.x * w, y: base.y - n.y * w }]
  }
  // Written along the line, turned so that it is never upside down, on the side that is then above.
  // A vertical dimension is read from the right of the sheet (bottom to top), as the standard asks.
  let angle = Math.atan2(u.y, u.x)
  if (angle >= Math.PI / 2 - 1e-9) angle -= Math.PI
  else if (angle < -Math.PI / 2 - 1e-9) angle += Math.PI
  const up = { x: Math.sin(angle), y: -Math.cos(angle) }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const gap = figureSize * FIGURE_GAP
  return { arrows: [head(a, 1), head(b, -1)], figureAt: { x: mid.x + up.x * gap, y: mid.y + up.y * gap }, angle }
}
