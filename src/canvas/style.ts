import { mmToPt } from '../geometry/units'
import type { LayerId, Pencil } from '../types'

export const ACCENT = '#2563EB'

const GRAPHITE: Record<Pencil['hardness'], string> = {
  '2H': '#7C8492',
  H: '#5B6270',
  HB: '#1F2329',
}

/** Pencil look: width is the real lead width on paper; the softer the lead, the darker (2H < H < HB). */
export const pencilStroke = (pencil: Pencil) => ({
  color: GRAPHITE[pencil.hardness],
  width: mmToPt(pencil.width),
})

export const LAYER_OPACITY: Record<LayerId, number> = {
  construccion: 1,
  auxiliares: 0.55,
  resultado: 1,
}

/** Pencil picked automatically when switching to each layer. */
export const LAYER_PENCIL: Record<LayerId, Pencil> = {
  construccion: { width: 0.25, hardness: '2H' },
  auxiliares: { width: 0.5, hardness: 'H' },
  resultado: { width: 0.5, hardness: 'HB' },
}

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'construccion', name: 'Construcción' },
  { id: 'auxiliares', name: 'Auxiliares' },
  { id: 'resultado', name: 'Resultado' },
]
