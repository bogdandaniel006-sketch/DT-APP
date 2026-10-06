export interface Vec {
  x: number
  y: number
}

/**
 * World coordinates are PDF points (1/72 in) of the page at scale 1,
 * with the y axis pointing down. Angles are radians in that same frame.
 */
export type Geometry =
  | { kind: 'segment'; a: Vec; b: Vec }
  | { kind: 'circle'; c: Vec; r: number }
  | { kind: 'arc'; c: Vec; r: number; start: number; sweep: number }
  | { kind: 'point'; p: Vec }

export type GeometryKind = Geometry['kind']

/** Measurements: annotations on their own visibility layer, never snap targets. */
export type Measure =
  | { kind: 'distance'; a: Vec; b: Vec }
  /** Angle at vertex b, from ray b→a to ray b→c. */
  | { kind: 'angle'; a: Vec; b: Vec; c: Vec }

export type Drawable = Geometry | Measure

export type LayerId = 'construccion' | 'auxiliares' | 'resultado'

export type PencilWidth = 0.25 | 0.35 | 0.5
export type PencilHardness = '2H' | 'H' | 'HB'

export interface Pencil {
  width: PencilWidth
  hardness: PencilHardness
  /** Dashed stroke. Only ever set by hand: no layer or default turns it on. */
  dashed?: boolean
  /** Colour other than graphite (hex). Like dashes, only ever set by hand. */
  color?: string
}

/** Everything stored in the document, in the coordinates of its page. */
export type Shape = Drawable & {
  id: string
  page: number
  layer: LayerId
  pencil: Pencil
  /** Name of a point, a line or a circle (A, O', r, c1…); for a text, what is written. */
  name?: string
  /** A point that is a piece of writing: no dot, and its name is the text. */
  text?: boolean
  /** A segment that is a dimension line: arrowheads and its figure (the name, or else the length). */
  dimension?: boolean
}

export type GeometryShape = Shape & Geometry
export type MeasureShape = Shape & Measure

export const isMeasure = (s: Shape): s is MeasureShape => s.kind === 'distance' || s.kind === 'angle'
export const isGeometry = (s: Shape): s is GeometryShape => !isMeasure(s)
/** Written text: drawn and exported, but never something to snap to or build on. */
export const isText = (s: Shape): boolean => s.kind === 'point' && s.text === true

/** How strongly the cursor is pulled towards geometry. */
export type SnapMode = 'preciso' | 'normal' | 'libre'

export type ToolId =
  | 'select'
  | 'point'
  | 'line'
  | 'perpendicular'
  | 'parallel'
  | 'bisector'
  | 'compass'
  | 'arc'
  | 'escuadra'
  | 'cartabon'
  | 'measure-distance'
  | 'measure-angle'
  | 'dimension'
  | 'text'
  | 'eraser'

export type InstrumentKind = 'escuadra' | 'cartabon'

export interface InstrumentState {
  visible: boolean
  /** World position of the right-angle vertex. */
  pos: Vec
  rotation: number
  /** Length of the long leg, in world units. */
  size: number
  /** Turned over (mirrored across its long leg), as one does with a real cartabón. */
  flipped: boolean
}

export interface View {
  scale: number
  x: number
  y: number
}
