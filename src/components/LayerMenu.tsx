import { Check, Eye, EyeOff, Layers, Lock } from 'lucide-react'
import { LAYERS } from '../canvas/style'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import type { LayerId } from '../types'
import { IconButton } from './ui/IconButton'
import { Popover } from './ui/Popover'

const VisibilityToggle = ({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) => (
  <button
    type="button"
    aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
    onClick={(e) => {
      e.stopPropagation()
      onToggle()
    }}
    className={`grid h-7 w-7 place-items-center rounded-md outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-accent/40 ${visible ? 'text-ink/60' : 'text-faint'}`}
  >
    {visible ? <Eye size={15} /> : <EyeOff size={15} />}
  </button>
)

export const LayerMenu = () => {
  const layer = useStore(appStore, (s) => s.layer)
  const hidden = useStore(appStore, (s) => s.hiddenLayers)
  const pdfVisible = useStore(appStore, (s) => s.pdfVisible)
  const measuresVisible = useStore(appStore, (s) => s.measuresVisible)

  const toggle = (id: LayerId) =>
    appStore.set({ hiddenLayers: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id], selection: [] })

  return (
    <Popover
      side="right"
      trigger={({ open, toggle: t }) => (
        <IconButton label="Capas" tooltipSide="right" active={open} onClick={t}>
          <Layers size={18} />
        </IconButton>
      )}
    >
      {() => (
        <div className="w-56">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">Capas</p>
          {[...LAYERS].reverse().map((l) => {
            const active = l.id === layer
            return (
              <div
                key={l.id}
                role="menuitemradio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => appStore.set({ layer: l.id, hiddenLayers: hidden.filter((h) => h !== l.id) })}
                onKeyDown={(e) => e.key === 'Enter' && appStore.set({ layer: l.id })}
                className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-2.5 pr-1 text-[13px] outline-none transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04]"
              >
                <span className="grid w-4 place-items-center text-accent">{active && <Check size={14} strokeWidth={2.5} />}</span>
                <span className={`flex-1 ${active ? 'font-medium text-accent' : 'text-ink'}`}>{l.name}</span>
                <VisibilityToggle visible={!hidden.includes(l.id)} onToggle={() => toggle(l.id)} label={l.name} />
              </div>
            )
          })}
          <div className="mx-2 my-1 h-px bg-black/[0.06]" />
          <div className="flex items-center gap-2 rounded-lg py-1 pl-2.5 pr-1 text-[13px] text-ink">
            <span className="w-4" />
            <span className="flex-1">Medidas</span>
            <VisibilityToggle
              visible={measuresVisible}
              onToggle={() => appStore.set({ measuresVisible: !measuresVisible, selection: [] })}
              label="medidas"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg py-1 pl-2.5 pr-1 text-[13px] text-muted">
            <span className="grid w-4 place-items-center text-faint">
              <Lock size={12} />
            </span>
            <span className="flex-1">PDF · bloqueado</span>
            <VisibilityToggle visible={pdfVisible} onToggle={() => appStore.set({ pdfVisible: !pdfVisible })} label="PDF" />
          </div>
        </div>
      )}
    </Popover>
  )
}
