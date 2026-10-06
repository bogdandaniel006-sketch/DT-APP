import { DraftingCompass, Eraser, MousePointer2, MoveHorizontal, RulerDimensionLine, Slash, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { appStore, hideInstrument, setTool } from '../state/appStore'
import { useStore } from '../state/createStore'
import { shortcutLabel, shortcutStore, type ShortcutId } from '../state/shortcuts'
import type { ToolId } from '../types'
import { LayerMenu } from './LayerMenu'
import { ArcIcon, BisectorIcon, CartabonIcon, EscuadraIcon, ParallelIcon, PerpendicularIcon, PointIcon } from './ToolIcons'
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
  { id: 'escuadra', label: 'Escuadra', icon: <EscuadraIcon /> },
  { id: 'cartabon', label: 'Cartabón', icon: <CartabonIcon /> },
  { id: 'measure-distance', label: 'Medir distancia y ángulo', icon: <RulerDimensionLine size={18} /> },
  { id: 'dimension', label: 'Cota', icon: <MoveHorizontal size={18} /> },
  { id: 'text', label: 'Texto', icon: <Type size={18} /> },
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
      className="float absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-2xl p-1.5"
    >
      {TOOLS.map((t) => {
        // One button for both measuring modes; the bottom bar switches between them.
        const active = tool === t.id || (t.id === 'measure-distance' && tool === 'measure-angle')
        const instrumentOn = (t.id === 'escuadra' || t.id === 'cartabon') && instruments[t.id].visible
        return (
          <div key={t.id} className="relative">
            {active && <span className="absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
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
      <div className="mx-2 my-1 h-px bg-black/[0.06]" />
      <LayerMenu />
    </nav>
  )
}
