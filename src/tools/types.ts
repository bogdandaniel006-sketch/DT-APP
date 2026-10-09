import type { AngleMark } from '../geometry/angles'
import type { Segment } from '../geometry/primitives'
import type { SnapResult } from '../geometry/snapping'
import type { Drawable, Geometry, Shape, SnapMode, Vec } from '../types'

export interface ToolPointer {
  /** Desk coordinates (PDF points), converted from the screen by the view transform. */
  world: Vec
  screen: Vec
  shift: boolean
  alt: boolean
  /** Ctrl, or ⌘ on a Mac. */
  ctrl: boolean
}

/** Transient visuals a tool asks the canvas to draw (desk coordinates). */
export type Overlay =
  | { kind: 'ghost'; geom: Geometry; faint?: boolean }
  | { kind: 'highlight'; geom: Geometry; tone?: 'accent' | 'danger' }
  | { kind: 'guide'; a: Vec; b: Vec }
  | { kind: 'ray'; origin: Vec; dir: number }
  | { kind: 'marker'; p: Vec; label?: string; handle?: boolean }
  | { kind: 'label'; at: Vec; text: string; offset?: Vec }
  | { kind: 'angle'; mark: AngleMark; showValue?: boolean; text?: string }
  | { kind: 'snap'; snap: SnapResult }
  | { kind: 'marquee'; a: Vec; b: Vec }

/** A straight reference line: drawn by the user (with id) or detected in the PDF. */
export interface ReferenceLine {
  seg: Segment
  id?: string
}

export interface ToolApi {
  /** Shapes on visible layers, in desk coordinates (all pages). */
  readonly shapes: readonly Shape[]
  readonly instrumentEdges: readonly Segment[]
  /** Directions of the visible instrument edges (for angle snapping). */
  readonly instrumentAngles: readonly number[]
  readonly snapMode: SnapMode
  /** Converts a screen distance to desk units at the current zoom. */
  px(n: number): number
  /** Snaps to drawn shapes (minus `exclude`), PDF geometry and, unless disabled, instrument edges. */
  snap(p: Vec, exclude?: ReadonlySet<string>, withInstruments?: boolean): SnapResult
  /**
   * Snaps without leaving the line through `origin` with direction `dir`: the result is the
   * projection of p, moved to where the line cuts nearby geometry or to a point lying on it.
   */
  snapAlong(p: Vec, origin: Vec, dir: Vec, exclude?: ReadonlySet<string>): SnapResult
  hit(p: Vec, filter?: (s: Shape) => boolean): Shape | null
  /** Height the names of points, lines and curves are written at on screen (desk units). */
  readonly nameSize: number
  /** The shape whose name is written under p, and the centre of that name. */
  nameAt(p: Vec): { shape: Shape; centre: Vec } | null
  /** A drawn segment or a line of the PDF under p. */
  lineAt(p: Vec): ReferenceLine | null
  /** Drawn and PDF straight lines near p (desk coordinates). */
  linesNear(p: Vec, r: number): Segment[]
  /** Position of a page on the desk; shapes are stored relative to it. */
  pageOffset(page: number): Vec
  /** Page under a desk point (or the nearest one). */
  pageAt(p: Vec): number
  /** Next automatic point name on the page under p: A, B, C… */
  nextPointName(p: Vec): string
  /** Adds geometry with the current pencil, layer and page. Returns the new ids. */
  create(items: readonly (Drawable & { name?: string; dimension?: boolean })[]): string[]
}

export interface Tool {
  down(e: ToolPointer, api: ToolApi): void
  move(e: ToolPointer, api: ToolApi): void
  up(e: ToolPointer, api: ToolApi): void
  /** Abort the current construction (Esc / right click). Returns false if there was nothing to cancel. */
  cancel(): boolean
  overlays(api: ToolApi): Overlay[]
  hint(): string | null
  cursor?(): string
}
