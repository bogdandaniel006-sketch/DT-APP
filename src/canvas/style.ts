import { mmToPt } from '../geometry/units'
import type { LayerId, Pencil } from '../types'

export const ACCENT = '#2563EB'

const GRAPHITE: Record<Pencil['hardness'], string> = {
  H: '#5B6270',
  HB: '#1F2329',
}

/** Pencil look: width is the real lead width on paper; HB is darker than H. */
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
  construccion: { width: 0.35, hardness: 'H' },
  auxiliares: { width: 0.5, hardness: 'H' },
  resultado: { width: 0.5, hardness: 'HB' },
}

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'construccion', name: 'Construcción' },
  { id: 'auxiliares', name: 'Auxiliares' },
  { id: 'resultado', name: 'Resultado' },
]
