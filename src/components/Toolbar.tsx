import { DraftingCompass, Eraser, MousePointer2, MoveHorizontal, PencilLine, RulerDimensionLine, Slash, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { appStore, hideInstrument, setTool } from '../state/appStore'
import { useStore } from '../state/createStore'
import { shortcutLabel, shortcutStore, type ShortcutId } from '../state/shortcuts'
import type { ToolId } from '../types'
import { LayerMenu } from './LayerMenu'
import { ArcIcon, BisectorIcon, CartabonIcon, ConicIcon, EscuadraIcon, HatchIcon, ParallelIcon, PerpendicularIcon, PointIcon } from './ToolIcons'
import { IconButton } from './ui/IconButton'

interface ToolDef {
  id: ToolId
  label: string
  /** Fixed key; every other tool takes its key from the user's shortcuts. */
  shortcut?: string
  icon: ReactNode
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Seleccionar', icon: <MousePointer2 size={18} /> },
  { id: 'point', label: 'Punto', icon: <PointIcon /> },
  { id: 'line', label: 'Línea', icon: <Slash size={18} /> },
  { id: 'perpendicular', label: 'Perpendicular', icon: <PerpendicularIcon /> },
  { id: 'parallel', label: 'Paralela', icon: <ParallelIcon /> },
  { id: 'bisector', label: 'Mediatriz', icon: <BisectorIcon /> },
  { id: 'compass', label: 'Compás', icon: <DraftingCompass size={18} /> },
  { id: 'arc', label: 'Arco', icon: <ArcIcon /> },
  { id: 'conic', label: 'Cónicas: elipse, hipérbola y parábola', icon: <ConicIcon /> },
  { id: 'escuadra', label: 'Escuadra', icon: <EscuadraIcon /> },
  { id: 'cartabon', label: 'Cartabón', icon: <CartabonIcon /> },
  { id: 'measure-distance', label: 'Medir distancia y ángulo', icon: <RulerDimensionLine size={18} /> },
  { id: 'dimension', label: 'Cota', icon: <MoveHorizontal size={18} /> },
  { id: 'text', label: 'Texto', icon: <Type size={18} /> },
  { id: 'freehand', label: 'Mano alzada: escribir y dibujar libre', icon: <PencilLine size={18} /> },
  { id: 'hatch', label: 'Rayado de cortes y secciones', icon: <HatchIcon /> },
  { id: 'eraser', label: 'Borrar', shortcut: 'Supr', icon: <Eraser size={18} /> },
]

export const Toolbar = () => {
  const tool = useStore(appStore, (s) => s.tool)
  const instruments = useStore(appStore, (s) => s.instruments)
  const keys = useStore(shortcutStore, (s) => s.keys)

  const choose = (id: ToolId) => {
    if ((id === 'escuadra' || id === 'cartabon') && tool === id) hideInstrument(id)
    else if (id === 'measure-distance' && tool === 'measure-angle') return
    else setTool(id)
  }

  return (
    <nav
      aria-label="Herramientas"
      // A phone held upright: one row along the bottom that slides sideways. Held sideways: four columns.
      className="float absolute left-4 top-4 z-20 grid grid-cols-2 gap-1 rounded-2xl p-1.5 short:left-2 short:top-2 short:grid-cols-4 max-sm:inset-x-2 max-sm:bottom-2 max-sm:top-auto max-sm:z-30 max-sm:flex max-sm:items-center"
    >
      <div className="contents max-sm:no-scrollbar max-sm:flex max-sm:min-w-0 max-sm:flex-1 max-sm:gap-1 max-sm:overflow-x-auto">
      {TOOLS.map((t) => {
        // One button for both measuring modes; the bottom bar switches between them.
        const active = tool === t.id || (t.id === 'measure-distance' && tool === 'measure-angle')
        const instrumentOn = (t.id === 'escuadra' || t.id === 'cartabon') && instruments[t.id].visible
        return (
          <div key={t.id} className="relative">
            <IconButton
              label={instrumentOn && active ? `${t.label} · clic para guardarla` : t.label}
              shortcut={t.shortcut ?? shortcutLabel(keys[t.id as ShortcutId])}
              tooltipSide="right"
              active={active}
              dot={instrumentOn && !active}
              onClick={() => choose(t.id)}
            >
              {t.icon}
            </IconButton>
          </div>
        )
      })}
      </div>
      <div className="col-span-2 mx-2 my-1 h-px bg-black/[0.06] short:col-span-4 max-sm:mx-0.5 max-sm:my-0 max-sm:h-6 max-sm:w-px max-sm:shrink-0" />
      {/* Relative: the layers reminder opens beside the whole bar, not over it. */}
      <div className="relative col-span-2 flex justify-center short:col-span-4 max-sm:shrink-0">
        <LayerMenu />
      </div>
    </nav>
  )
}
