/** World units are PDF points. */
export const PT_PER_MM = 72 / 25.4
/** CSS pixels per PDF point at 100 % zoom (real paper size on a 96 dpi screen). */
export const PX_PER_PT = 96 / 72

export const ptToMm = (pt: number): number => pt / PT_PER_MM
export const mmToPt = (mm: number): number => mm * PT_PER_MM
