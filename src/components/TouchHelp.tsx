import { Hand, Maximize, PencilLine, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { createStore, useStore } from '../state/createStore'
import { declineTouch, setTouch, touchStore } from '../utils/device'

/**
 * The touch controls, explained when the desk opens on a phone or a tablet (every visit, until
 * closed; the hand button brings it back). The layers reminder waits until it is closed.
 */
export const touchHelpStore = createStore<{ open: boolean }>({ open: touchStore.get().on })

// Turned on later (on a computer touched with two fingers): the controls are explained then.
let wasOn = touchStore.get().on
touchStore.subscribe(() => {
  const { on } = touchStore.get()
  if (on && !wasOn) touchHelpStore.set({ open: true })
  if (!on) touchHelpStore.set({ open: false })
  wasOn = on
})

export const openTouchHelp = () => touchHelpStore.set({ open: true })
const close = () => touchHelpStore.set({ open: false })

/** A gesture drawn as fingers: dots, as many as fingers it takes. */
const Fingers = ({ n }: { n: number }) => (
  <span className="flex h-7 w-11 shrink-0 items-center justify-center gap-[3px] rounded-lg bg-accent-soft" aria-hidden>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} className="h-2 w-2 rounded-full bg-accent" />
    ))}
  </span>
)

const Icon = ({ children }: { children: ReactNode }) => (
  <span className="grid h-7 w-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent" aria-hidden>
    {children}
  </span>
)

const Row = ({ sign, children }: { sign: ReactNode; children: ReactNode }) => (
  <li className="flex items-center gap-3 text-[12.5px] leading-snug text-ink/80">
    {sign}
    <p>{children}</p>
  </li>
)

/**
 * On a computer touched with two fingers (a laptop shown on a classroom touch screen): the touch
 * controls are offered, at the top, until answered. The answer is remembered on that computer.
 */
export const TouchOffer = () => {
  const offered = useStore(touchStore, (s) => s.offered)
  if (!offered) return null
  return (
    <div
      role="dialog"
      aria-label="Activar los controles táctiles"
      className="float animate-pop absolute left-1/2 top-4 z-40 w-[380px] max-w-[calc(100%-24px)] -translate-x-1/2 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Hand size={18} />
        </span>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-ink">¿Usas una pantalla táctil?</p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            Activa los controles con los dedos: pellizca para acercar o alejar, mueve la hoja con dos dedos y deshaz con un toque de dos
            dedos.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={declineTouch}
          className="h-9 flex-1 rounded-[10px] text-[13px] font-medium text-ink ring-1 ring-black/10 outline-none transition-colors hover:bg-black/[0.035]"
        >
          Ahora no
        </button>
        <button
          type="button"
          onClick={() => setTouch(true)}
          className="h-9 flex-1 rounded-[10px] bg-accent text-[13px] font-medium text-white outline-none transition-opacity hover:opacity-90"
        >
          Activar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-faint">Puedes cambiarlo cuando quieras en el menú de Controles (el teclado).</p>
    </div>
  )
}

export const TouchHelp = () => {
  const open = useStore(touchHelpStore, (s) => s.open)
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-label="Controles táctiles"
      className="float animate-pop absolute left-1/2 top-1/2 z-40 max-h-[calc(100%-24px)] w-[360px] max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-4"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[14px] font-semibold text-ink">Controles con los dedos</p>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={close}
          className="-mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-md text-muted outline-none hover:bg-black/[0.05] hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>
      <ul className="mt-3 space-y-2.5">
        <Row sign={<Fingers n={1} />}>
          <b className="font-semibold text-ink">Un dedo</b>: dibuja con la herramienta elegida. Toca para marcar puntos o arrastra para trazar.
        </Row>
        <Row sign={<Fingers n={2} />}>
          <b className="font-semibold text-ink">Dos dedos</b>: sepáralos para acercar, júntalos (pellizca) para alejar y arrástralos para mover la hoja.
        </Row>
        <Row sign={<Fingers n={3} />}>
          <b className="font-semibold text-ink">Tres o más dedos</b>: mueve la hoja sin cambiar el zoom.
        </Row>
        <Row sign={<Fingers n={2} />}>
          <b className="font-semibold text-ink">Toque rápido con dos dedos</b>: deshace lo último.
        </Row>
        <Row sign={<Fingers n={3} />}>
          <b className="font-semibold text-ink">Toque rápido con tres dedos</b>: lo rehace.
        </Row>
        <Row
          sign={
            <Icon>
              <PencilLine size={15} />
            </Icon>
          }
        >
          <b className="font-semibold text-ink">Mano alzada</b>, en las herramientas: para escribir o dibujar libre. Con un lápiz táctil, la mano apoyada en la pantalla no pinta.
        </Row>
        <Row
          sign={
            <Icon>
              <Maximize size={15} />
            </Icon>
          }
        >
          <b className="font-semibold text-ink">Ver la hoja entera</b>: el botón de las páginas que tiene este icono.
        </Row>
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted">
        <Hand size={13} className="shrink-0" /> Vuelve a ver esto con el botón de la mano, junto a las páginas.
      </p>
      <button
        type="button"
        onClick={close}
        className="mt-3 h-10 w-full rounded-[10px] bg-accent text-[13px] font-medium text-white outline-none transition-opacity hover:opacity-90"
      >
        Entendido
      </button>
    </div>
  )
}
