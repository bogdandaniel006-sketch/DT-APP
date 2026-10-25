import { Check, Eye, EyeOff, Layers, Lock, X } from 'lucide-react'
import { LAYER_PENCIL, LAYERS } from '../canvas/style'
import { appStore, setLayer } from '../state/appStore'
import { shortcutLabel, shortcutStore } from '../state/shortcuts'
import { createStore, useStore } from '../state/createStore'
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

/** What each layer is for, in the order they are switched to with the keyboard. */
const LAYER_USES: Record<LayerId, string> = {
  construccion: 'las líneas con las que construyes: rectas, arcos y trazos del compás.',
  auxiliares: 'las ayudas que no son la solución: ejes, prolongaciones y datos. Se ven más suaves.',
  resultado: 'la solución final, lo que tiene que destacar en la lámina.',
}

const pencilName = (id: LayerId) => {
  const { width, hardness } = LAYER_PENCIL[id]
  return `${String(width).replace('.', ',')} · ${hardness}`
}

/** The reminder is closed for as long as the page stays open; every new visit shows it again. */
const layerTipStore = createStore<{ open: boolean }>({ open: true })
const closeLayerTip = () => layerTipStore.set({ open: false })

/**
 * A reminder of how layers work, shown as soon as the app is opened (every visit) until closed:
 * on the start screen at the top left, on the desk beside the layers button. Many draw everything
 * on one layer: this tells what each is for and how to switch between them.
 */
const LayerTip = ({ onStart = false }: { onStart?: boolean }) => {
  const keys = useStore(shortcutStore, (s) => s.keys)
  const onClose = closeLayerTip
  return (
    <div
      role="dialog"
      aria-label="Cómo usar las capas"
      className={`float animate-pop z-40 w-[330px] rounded-2xl p-4 text-left max-sm:fixed max-sm:inset-x-3 max-sm:bottom-28 max-sm:ml-0 max-sm:w-auto ${
        onStart ? 'fixed left-4 top-4' : 'absolute bottom-0 left-full ml-3.5'
      }`}
    >
      {/* The point of the bubble, towards the layers button. */}
      {!onStart && <span className="absolute -left-1.5 bottom-3.5 h-3 w-3 rotate-45 bg-white max-sm:hidden" aria-hidden />}
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[14px] font-semibold text-ink">Dibuja cada cosa en su capa</p>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-black/[0.05] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X size={15} />
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">
        Como en papel: cada capa tiene su lápiz. Cambia de capa con las teclas del teclado y el lápiz se pone solo.
      </p>
      <ul className="mt-3 space-y-2.5">
        {LAYERS.map((l) => (
          <li key={l.id} className="flex gap-2.5">
            <kbd className="grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-accent-soft px-1.5 font-sans text-[12px] font-semibold text-accent">
              {shortcutLabel(keys[`layer-${l.id}`])}
            </kbd>
            <p className="text-[12.5px] leading-snug text-ink/80">
              <span className="font-semibold text-ink">{l.name}</span>{' '}
              <span className="whitespace-nowrap text-[11.5px] font-medium text-accent">({pencilName(l.id)})</span>: {LAYER_USES[l.id]}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-muted">
        {onStart
          ? 'Las capas están en el último botón de la barra de herramientas, a la izquierda: ahí ves en cuál estás y, con el ojo, puedes ocultar cada una.'
          : 'En este botón de capas ves en cuál estás y, con el ojo, puedes ocultar cada una para revisar tu dibujo.'}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 h-9 w-full rounded-[10px] bg-accent text-[13px] font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        Entendido
      </button>
    </div>
  )
}

/** The reminder on the start screen, while it has not been closed. */
export const StartLayerTip = () => (useStore(layerTipStore, (s) => s.open) ? <LayerTip onStart /> : null)

export const LayerMenu = () => {
  const tip = useStore(layerTipStore, (s) => s.open)
  return (
    <>
      <LayerPopover onOpen={closeLayerTip} />
      {tip && <LayerTip />}
    </>
  )
}

/** The layers button and its menu: which one is drawn on, which are shown. */
const LayerPopover = ({ onOpen }: { onOpen: () => void }) => {
  const layer = useStore(appStore, (s) => s.layer)
  const hidden = useStore(appStore, (s) => s.hiddenLayers)
  const pdfVisible = useStore(appStore, (s) => s.pdfVisible)
  const measuresVisible = useStore(appStore, (s) => s.measuresVisible)
  const keys = useStore(shortcutStore, (s) => s.keys)

  const toggle = (id: LayerId) =>
    appStore.set({ hiddenLayers: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id], selection: [] })

  return (
    <Popover
      side="right"
      trigger={({ open, toggle: t }) => (
        <IconButton
          label="Capas"
          tooltipSide="right"
          active={open}
          onClick={() => {
            onOpen()
            t()
          }}
        >
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
                onClick={() => setLayer(l.id)}
                onKeyDown={(e) => e.key === 'Enter' && setLayer(l.id)}
                className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-2.5 pr-1 text-[13px] outline-none transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04]"
              >
                <span className="grid w-4 place-items-center text-accent">{active && <Check size={14} strokeWidth={2.5} />}</span>
                <span className={`flex-1 ${active ? 'font-medium text-accent' : 'text-ink'}`}>{l.name}</span>
                <kbd className="rounded-[5px] bg-black/[0.04] px-1.5 py-px font-sans text-[10.5px] font-semibold text-muted">
                  {shortcutLabel(keys[`layer-${l.id}`])}
                </kbd>
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
