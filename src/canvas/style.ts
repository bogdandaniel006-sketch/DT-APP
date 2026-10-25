import { mmToPt } from '../geometry/units'
import type { LayerId, Pencil } from '../types'

export const ACCENT = '#2563EB'

const GRAPHITE: Record<Pencil['hardness'], string> = {
  '2H': '#7C8492',
  H: '#5B6270',
  HB: '#1F2329',
}

/**
 * Colours a stroke can take instead of graphite, dark enough to read on white paper, in the
 * order of the rainbow. Graphite (no colour) is always the default; any other can be picked too.
 */
export const PENCIL_COLORS: readonly { value: string; label: string }[] = [
  { value: '#DC2626', label: 'Rojo' },
  { value: '#EA580C', label: 'Naranja' },
  { value: '#CA8A04', label: 'Amarillo' },
  { value: '#65A30D', label: 'Verde lima' },
  { value: '#15803D', label: 'Verde' },
  { value: '#0D9488', label: 'Turquesa' },
  { value: '#0284C7', label: 'Celeste' },
  { value: '#1D4ED8', label: 'Azul' },
  { value: '#7C3AED', label: 'Morado' },
  { value: '#DB2777', label: 'Rosa' },
  { value: '#92400E', label: 'Marrón' },
  { value: '#64748B', label: 'Gris' },
]

/** Dashed strokes: dash and gap on paper, as drawn by hand for hidden lines. */
const DASH: readonly [number, number] = [mmToPt(3), mmToPt(1.5)]

/** The black sheet, chosen when making a blank one: drawn on in white. */
export const SHEET_DARK = '#16181B'

/** Graphite on the black sheet: light, the softer the lead the whiter, as chalk on a board. */
const GRAPHITE_ON_DARK: Record<Pencil['hardness'], string> = {
  '2H': '#8E95A1',
  H: '#BCC2CB',
  HB: '#F2F4F6',
}

/** What surrounds letters to keep them readable: the colour of the sheet. */
export const sheetColor = (dark: boolean) => (dark ? SHEET_DARK : '#FFFFFF')

/** Pencil look: width is the real lead width on paper; the softer the lead, the darker (2H < H < HB). */
export const pencilStroke = (pencil: Pencil, dark = false) => ({
  color: pencil.color ?? (dark ? GRAPHITE_ON_DARK : GRAPHITE)[pencil.hardness],
  width: mmToPt(pencil.width),
  dash: pencil.dashed ? DASH : null,
})

export const LAYER_OPACITY: Record<LayerId, number> = {
  construccion: 1,
  auxiliares: 0.55,
  resultado: 1,
}

/** Pencil picked automatically when switching to each layer. */
export const LAYER_PENCIL: Record<LayerId, Pencil> = {
  construccion: { width: 0.25, hardness: '2H' },
  auxiliares: { width: 0.35, hardness: 'H' },
  resultado: { width: 0.35, hardness: 'HB' },
}

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'construccion', name: 'Construcción' },
  { id: 'auxiliares', name: 'Auxiliares' },
  { id: 'resultado', name: 'Resultado' },
]
