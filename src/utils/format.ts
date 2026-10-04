import { ptToMm } from '../geometry/units'
import { toDeg } from '../geometry/vec'

const decimal = (value: number, digits: number) => value.toFixed(digits).replace('.', ',')

/** Formats a world length as millimetres, e.g. "37,4 mm". */
export const formatLength = (pt: number): string => `${decimal(ptToMm(pt), 1)} mm`

/** Formats radians as degrees; whole values drop the decimal, e.g. "32°", "37,5°". */
export const formatAngle = (rad: number): string => {
  const deg = Math.abs(toDeg(rad))
  const rounded = Math.round(deg * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}°` : `${decimal(rounded, 1)}°`
}

/** Measuring-tool precision, e.g. "42,35 mm". */
export const formatPrecise = (pt: number): string => `${decimal(ptToMm(pt), 2)} mm`

/** A coordinate in millimetres from the page's top-left corner, e.g. "52,30". */
export const formatCoordinate = (pt: number): string => decimal(ptToMm(pt), 2)
