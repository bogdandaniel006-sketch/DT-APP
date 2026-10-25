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
  | Conic
  /** Drawn freehand (writing, sketching): the line as the pen went, simplified. */
  | { kind: 'stroke'; pts: Vec[] }

export type ConicType = 'ellipse' | 'hyperbola' | 'parabola'

/**
 * Ellipse, hyperbola or parabola, as defined in technical drawing. `c` is the centre (the
 * vertex of a parabola) and `rot` the direction of the main axis (major, real, or towards the
 * focus). For an ellipse `a` and `b` are the semi-axes; for a hyperbola `a` is the half real
 * axis and `b` the half imaginary one; for a parabola `a` is the distance from vertex to focus.
 * The open curves reach `reach` either side of their axis. `paths` is the curve itself, finely
 * drawn: what is shown, snapped to and exported.
 */
export interface Conic {
  kind: 'conic'
  type: ConicType
  c: Vec
  rot: number
  a: number
  b: number
  reach: number
  paths: Vec[][]
}

export type GeometryKind = Geometry['kind']

/** Measurements: annotations on their own visibility layer, never snap targets. */
export type Measure =
  | { kind: 'distance'; a: Vec; b: Vec }
  /** Angle at vertex b, from ray b→a to ray b→c. */
  | { kind: 'angle'; a: Vec; b: Vec; c: Vec }

/**
 * Section lining (rayado de cortes y secciones): thin parallel lines filling a closed area.
 * The lines are kept as drawn; the seed is a point inside the area, to find it again when the
 * angle or the spacing is changed.
 */
export interface Hatch {
  kind: 'hatch'
  seed: Vec
  /** Slope of the lines on paper, in degrees: 45 rises to the right ("/"), 135 falls ("\"). */
  angle: number
  /** Distance between lines, in millimetres on paper. */
  spacing: number
  lines: [Vec, Vec][]
}

export type Drawable = Geometry | Measure | Hatch

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
  /** Letter height of a text, in millimetres on paper (the usual one when absent). */
  size?: number
  /** A segment that is a dimension line: arrowheads and its figure (the name, or else the length). */
  dimension?: boolean
  /** Where the name was moved by hand (Ctrl + drag); placed automatically when absent. */
  nameSpot?: NameSpot
}

/**
 * A name moved by hand: the place along its line, curve or point it hangs from (`t`: fraction of
 * a segment or an arc, angle on a circle) and the offset of the centre of the letters from there.
 */
export interface NameSpot {
  t: number
  dx: number
  dy: number
}

export type GeometryShape = Shape & Geometry
export type MeasureShape = Shape & Measure
export type HatchShape = Shape & Hatch

export const isMeasure = (s: Shape): s is MeasureShape => s.kind === 'distance' || s.kind === 'angle'
export const isHatch = (s: Shape): s is HatchShape => s.kind === 'hatch'
export const isGeometry = (s: Shape): s is GeometryShape => !isMeasure(s) && !isHatch(s)
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
  | 'hatch'
  | 'conic'
  | 'freehand'
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
