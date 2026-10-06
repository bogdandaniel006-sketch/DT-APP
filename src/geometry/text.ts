import type { Vec } from '../types'
import { mmToPt } from './units'

/**
 * Written text. A text is stored as a point without a dot whose name is what is written
 * (see `isText`), anchored at the left end of the baseline of its first line, so it moves,
 * is selected, layered, coloured and exported like any other shape. It may have several
 * lines and its own letter size.
 */

/** Letter heights a text can have, in millimetres on paper. */
export const TEXT_SIZES_MM = [2.5, 3.5, 5, 7, 10] as const
export const DEFAULT_TEXT_MM = 3.5
export const MAX_TEXT_LENGTH = 2000
/** Distance between the baselines of consecutive lines, as a fraction of the letter size. */
export const LINE_HEIGHT = 1.3

/** Average width of a character, as a fraction of the letter size. */
const CHAR_WIDTH = 0.56

/** Letter size of a text in world units, from the millimetres it was given (or the usual ones). */
export const textSize = (mm: number | undefined): number => mmToPt(mm ?? DEFAULT_TEXT_MM)

export const textLines = (text: string): string[] => text.split('\n')

/** Distance from p to the box the text occupies (0 inside it), to click and erase it by its letters. */
export const distanceToText = (p: Vec, anchor: Vec, text: string, size: number): number => {
  const lines = textLines(text)
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const maxX = anchor.x + size * CHAR_WIDTH * longest
  const minY = anchor.y - size * 0.8
  const maxY = anchor.y + size * (0.25 + LINE_HEIGHT * (lines.length - 1))
  const dx = Math.max(anchor.x - p.x, 0, p.x - maxX)
  const dy = Math.max(minY - p.y, 0, p.y - maxY)
  return Math.hypot(dx, dy)
}
