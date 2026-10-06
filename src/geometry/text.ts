import type { Vec } from '../types'
import { mmToPt } from './units'

/**
 * Written text. A text is stored as a point without a dot whose name is what is written
 * (see `isText`), anchored at the left end of its baseline, so it moves, is selected,
 * layered, coloured and exported like any other shape.
 */

/** Height of written text, as on paper. */
export const TEXT_SIZE = mmToPt(3.5)
/** On screen text never gets smaller than this. */
export const MIN_TEXT_PX = 11
export const MAX_TEXT_LENGTH = 120

/** Average width of a character, as a fraction of the letter size. */
const CHAR_WIDTH = 0.56

/** Distance from p to the box the text occupies (0 inside it), to click and erase it by its letters. */
export const distanceToText = (p: Vec, anchor: Vec, text: string, size = TEXT_SIZE): number => {
  const maxX = anchor.x + size * CHAR_WIDTH * Math.max(1, text.length)
  const minY = anchor.y - size * 0.8
  const maxY = anchor.y + size * 0.25
  const dx = Math.max(anchor.x - p.x, 0, p.x - maxX)
  const dy = Math.max(minY - p.y, 0, p.y - maxY)
  return Math.hypot(dx, dy)
}
