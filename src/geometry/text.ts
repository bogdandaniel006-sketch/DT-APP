import type { Vec } from '../types'
import { mmToPt } from './units'

/**
 * Written text. A text is stored as a point without a dot whose name is what is written
 * (see `isText`), anchored at the left end of the baseline of its first line, so it moves,
 * is selected, layered, coloured and exported like any other shape. It may have several
 * lines and its own letter size.
 */

/** Letter height of a text until it is resized, in millimetres on paper. */
export const DEFAULT_TEXT_MM = 3.5
/** Letter heights a text can be dragged to, in millimetres. */
export const MIN_TEXT_MM = 1
export const MAX_TEXT_MM = 60
export const MAX_TEXT_LENGTH = 2000
/** Distance between the baselines of consecutive lines, as a fraction of the letter size. */
export const LINE_HEIGHT = 1.3

/** Average width of a character, as a fraction of the letter size. */
const CHAR_WIDTH = 0.56

/** Letter size of a text in world units, from the millimetres it was given (or the usual ones). */
export const textSize = (mm: number | undefined): number => mmToPt(mm ?? DEFAULT_TEXT_MM)

export const textLines = (text: string): string[] => text.split('\n')

/** How far the box of a text reaches above the baseline of its first line, as a fraction of the letter size. */
export const TEXT_ASCENT = 0.8
const TEXT_DESCENT = 0.25

let ruler: CanvasRenderingContext2D | null | undefined

/** Width of the widest line per unit of letter size, measured with the font texts are drawn in. */
const widthPerSize = (lines: readonly string[]): number => {
  if (ruler === undefined) ruler = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  const longest = Math.max(1, ...lines.map((l) => l.length))
  if (!ruler) return CHAR_WIDTH * longest
  ruler.font = '500 100px Inter, system-ui, sans-serif'
  const measured = Math.max(...lines.map((l) => ruler!.measureText(l).width)) / 100
  // An empty text still has a box to grab.
  return Math.max(measured, CHAR_WIDTH)
}

export interface TextBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** The box a text occupies, from the left end of the baseline of its first line. */
export const textBox = (anchor: Vec, text: string, size: number): TextBox => {
  const lines = textLines(text)
  return {
    minX: anchor.x,
    minY: anchor.y - size * TEXT_ASCENT,
    maxX: anchor.x + size * widthPerSize(lines),
    maxY: anchor.y + size * (TEXT_DESCENT + LINE_HEIGHT * (lines.length - 1)),
  }
}

/** Distance from p to the box the text occupies (0 inside it), to click and erase it by its letters. */
export const distanceToText = (p: Vec, anchor: Vec, text: string, size: number): number => {
  const box = textBox(anchor, text, size)
  const dx = Math.max(box.minX - p.x, 0, p.x - box.maxX)
  const dy = Math.max(box.minY - p.y, 0, p.y - box.maxY)
  return Math.hypot(dx, dy)
}
