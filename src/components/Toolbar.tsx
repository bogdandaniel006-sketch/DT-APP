import { DraftingCompass, Eraser, MousePointer2, RulerDimensionLine, Slash } from 'lucide-react'
import type { ReactNode } from 'react'
import { appStore, hideInstrument, setTool } from '../state/appStore'
import { useStore } from '../state/createStore'
import type { ToolId } from '../types'
import { LayerMenu } from './LayerMenu'
import { ArcIcon, CartabonIcon, EscuadraIcon, ParallelIcon, PerpendicularIcon, PointIcon } from './ToolIcons'
import { IconButton } from './ui/IconButton'

interface ToolDef {
  id: ToolId
  label: string
  shortcut: string
  icon: ReactNode
}

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Seleccionar', shortcut: 'V', icon: <MousePointer2 size={18} /> },
  { id: 'point', label: 'Punto', shortcut: '.', icon: <PointIcon /> },
  { id: 'line', label: 'Línea', shortcut: 'L', icon: <Slash size={18} /> },
  { id: 'perpendicular', label: 'Perpendicular', shortcut: 'P', icon: <PerpendicularIcon /> },
  { id: 'parallel', label: 'Paralela', shortcut: 'R', icon: <ParallelIcon /> },
  { id: 'compass', label: 'Compás', shortcut: 'C', icon: <DraftingCompass size={18} /> },
  { id: 'arc', label: 'Arco', shortcut: 'A', icon: <ArcIcon /> },
  { id: 'escuadra', label: 'Escuadra', shortcut: 'E', icon: <EscuadraIcon /> },
  { id: 'cartabon', label: 'Cartabón', shortcut: 'T', icon: <CartabonIcon /> },
  { id: 'measure-distance', label: 'Medir distancia y ángulo', shortcut: 'M', icon: <RulerDimensionLine size={18} /> },
  { id: 'eraser', label: 'Borrar', shortcut: 'Supr', icon: <Eraser size={18} /> },
]

export const Toolbar = () => {
  const tool = useStore(appStore, (s) => s.tool)
  const instruments = useStore(appStore, (s) => s.instruments)

  const choose = (id: ToolId) => {
    if ((id === 'escuadra' || id === 'cartabon') && tool === id) hideInstrument(id)
    else if (id === 'measure-distance' && tool === 'measure-angle') return
    else setTool(id)
  }

  return (
    <nav
      aria-label="Herramientas"
      className="float absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-2xl p-1.5"
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
              shortcut={t.shortcut}
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
