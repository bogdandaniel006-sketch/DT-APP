import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../state/createStore'
import { choose, closeReview, isCreator, sharingStore, type Choice } from '../state/sharing'
import { IconButton } from './ui/IconButton'

const BUTTON =
  'flex h-10 flex-1 items-center justify-center rounded-xl px-4 text-[13.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'

/**
 * Asks, on the first visit, whether the person wants to send their sheets to the author. Both
 * answers are as easy to give; until one is given nothing is sent. "Privacidad" opens it again.
 */
export const ConsentNotice = () => {
  const choice = useStore(sharingStore, (s) => s.choice)
  const reviewing = useStore(sharingStore, (s) => s.reviewing)
  const [busy, setBusy] = useState(false)
  const open = !isCreator() && (choice === null || reviewing)

  useEffect(() => {
    if (!reviewing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeReview()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reviewing])

  if (!open) return null

  const answer = async (value: Choice) => {
    setBusy(true)
    await choose(value)
    setBusy(false)
  }

  return (
    <section
      role="dialog"
      aria-label="Privacidad"
      className="animate-rise fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl bg-white p-4 shadow-[0_10px_36px_rgba(15,23,42,0.18)] sm:bottom-5 sm:p-5"
    >
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck size={19} />
        </span>
        <h2 className="flex-1 pt-1.5 text-[15.5px] font-semibold tracking-[-0.01em] text-ink">¿Nos ayudas a mejorar Lámina?</h2>
        {reviewing && (
          <IconButton label="Cerrar" onClick={closeReview}>
            <X size={17} />
          </IconButton>
        )}
      </header>
      <div className="mt-2 space-y-2 text-[13px] leading-snug text-ink/80">
        <p>
          Si aceptas, se envían al autor de Lámina <b className="font-semibold text-ink">copias de las láminas que abras y dibujes</b> (tus trazos y,
          si ocupa poco, el archivo) y lo que haces en la app: abrir, exportar y guardar. Solo sirven para encontrar fallos y mejorar la app, y no se comparten con
          nadie.
        </p>
        <p>Si rechazas, no sale nada de tu ordenador y la app funciona exactamente igual.</p>
        <p className="text-[12px] text-muted">
          Si tienes menos de 14 años, acepta solo con permiso de tu madre, padre o tutor. Puedes cambiarlo cuando quieras en «Privacidad», en el menú
          de Controles (el teclado) o abajo en la pantalla de inicio; si lo retiras, se borra todo lo enviado.{' '}
          <a href="/privacidad" target="_blank" rel="noopener" className="font-medium text-accent underline">
            Más información
          </a>
        </p>
        {reviewing && choice && (
          <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-[12.5px]">
            Ahora mismo: <b className="font-semibold">{choice === 'si' ? 'envías tus láminas' : 'no se envía nada'}</b>.
          </p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void answer('no')}
          className={`${BUTTON} bg-white text-ink ring-1 ring-black/15 hover:bg-black/[0.03]`}
        >
          {reviewing && choice === 'si' ? 'Dejar de enviar y borrar' : 'Rechazar'}
        </button>
        <button type="button" disabled={busy} onClick={() => void answer('si')} className={`${BUTTON} bg-accent text-white hover:bg-accent/90`}>
          Aceptar
        </button>
      </div>
    </section>
  )
}
