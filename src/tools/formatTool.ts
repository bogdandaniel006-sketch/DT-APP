import { LAYERS } from '../canvas/style'
import { outlineOf } from '../geometry/shapes'
import { documentActions } from '../state/documentStore'
import type { LayerId, Pencil, Shape } from '../types'
import type { Tool } from './types'

/** What the roller carries from one stroke to the others: how it looks, never where it is. */
interface Format {
  layer: LayerId
  pencil: Pencil
  /** Letter height, passed on only from a text to another text. */
  size?: number
}

const describe = (f: Format) => {
  const layer = LAYERS.find((l) => l.id === f.layer)?.name ?? f.layer
  const parts = [layer, `${String(f.pencil.width).replace('.', ',')} ${f.pencil.hardness}`]
  if (f.pencil.dashed) parts.push('discontinua')
  if (f.pencil.color) parts.push('en color')
  return parts.join(' · ')
}

/**
 * Copy format (the paint roller): a click on a stroke picks up its layer, pencil, dashes and
 * colour; then every stroke clicked, or dragged across, takes them. Each drag is one undo step.
 * Switching tools, Esc or a right click drop what was picked up, to take another.
 */
export const createFormatTool = (): Tool => {
  let format: Format | null = null
  let painting = false
  let hover: Shape | null = null

  const paint = (s: Shape | null) => {
    if (!s || !format) return
    const f = format
    documentActions.update([s.id], (t) => ({
      ...t,
      layer: f.layer,
      pencil: { ...f.pencil },
      ...(t.kind === 'point' && t.text && f.size !== undefined ? { size: f.size } : {}),
    }))
  }

  return {
    down(e, api) {
      const hit = api.hit(e.world)
      if (!format) {
        if (hit) format = { layer: hit.layer, pencil: { ...hit.pencil }, ...(hit.text ? { size: hit.size } : {}) }
        return
      }
      painting = true
      documentActions.beginGesture()
      paint(hit)
    },
    move(e, api) {
      hover = api.hit(e.world)
      if (painting) paint(hover)
    },
    up() {
      if (painting) documentActions.endGesture()
      painting = false
    },
    cancel() {
      const had = format !== null || painting
      if (painting) documentActions.endGesture()
      format = null
      painting = false
      hover = null
      return had
    },
    overlays() {
      return hover ? outlineOf(hover).map((geom) => ({ kind: 'highlight' as const, geom })) : []
    },
    hint() {
      return format
        ? `Formato copiado (${describe(format)}): haz clic o arrastra sobre los trazos que quieras cambiar · Esc para copiar otro`
        : 'Copiar formato: haz clic en el trazo cuyo formato quieres copiar'
    },
  }
}
