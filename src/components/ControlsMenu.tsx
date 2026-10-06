import { Keyboard, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../state/createStore'
import {
  SHORTCUT_ACTIONS,
  isBindable,
  isDefaultShortcuts,
  resetShortcuts,
  setShortcut,
  shortcutLabel,
  shortcutStore,
  type ShortcutId,
} from '../state/shortcuts'
import { IconButton } from './ui/IconButton'
import { Popover } from './ui/Popover'

interface Control {
  keys: string
  action: string
}

/** Controls that are the same for everyone: modifiers, mouse and system-like combinations. */
const FIXED: { title: string; controls: Control[] }[] = [
  {
    title: 'Dibujo',
    controls: [
      { keys: 'Shift', action: 'Bloquea el ángulo cada 15° al trazar o mover un extremo' },
      { keys: 'Ctrl + arrastrar extremo', action: 'Alarga la línea sin cambiar su dirección' },
      { keys: 'Alt', action: 'Mueve la escuadra o el cartabón sin enganche' },
      { keys: 'Esc · clic derecho', action: 'Cancela el trazo en curso' },
    ],
  },
  {
    title: 'Selección',
    controls: [
      { keys: 'Shift + clic', action: 'Añade o quita un trazo de la selección' },
      { keys: 'Arrastrar', action: 'Selecciona varios trazos con un recuadro' },
      { keys: 'Ctrl D', action: 'Duplica los trazos seleccionados' },
      { keys: 'Supr', action: 'Borra la selección; sin selección, herramienta Borrar' },
    ],
  },
  {
    title: 'Vista',
    controls: [
      { keys: 'Rueda', action: 'Desplaza la lámina' },
      { keys: 'Shift + rueda', action: 'Desplaza hacia los lados' },
      { keys: 'Ctrl + rueda', action: 'Zoom en el cursor' },
      { keys: 'Espacio + arrastrar', action: 'Mueve la lámina (también con el botón central)' },
      { keys: 'Ctrl 0', action: 'Ajustar página' },
      { keys: 'Ctrl 1', action: 'Zoom al 100%' },
      { keys: 'Ctrl + · Ctrl −', action: 'Acercar y alejar' },
      { keys: 'Re Pág · Av Pág', action: 'Página anterior y siguiente' },
    ],
  },
  {
    title: 'Archivo',
    controls: [
      { keys: 'Ctrl Z', action: 'Deshacer' },
      { keys: 'Ctrl ⇧ Z · Ctrl Y', action: 'Rehacer' },
      { keys: 'Ctrl O', action: 'Abrir PDF, imagen o proyecto' },
      { keys: 'Ctrl V', action: 'Abre la imagen copiada en una pestaña nueva' },
    ],
  },
]

const KEY_CLASS = 'shrink-0 rounded-[5px] px-1.5 py-px font-sans text-[10.5px] font-semibold'

const GroupTitle = ({ children }: { children: string }) => (
  <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">{children}</p>
)

/** The keys each user chooses: click one and press the new key. */
const Shortcuts = () => {
  const keys = useStore(shortcutStore, (s) => s.keys)
  const [editing, setEditing] = useState<ShortcutId | null>(null)

  // While a key is being chosen, the next key press belongs to this menu alone.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') return setEditing(null)
      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey || e.altKey || !isBindable(key)) return
      setShortcut(editing, key)
      setEditing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editing])

  return (
    <section className="pb-1.5">
      <div className="flex items-center justify-between pr-1.5">
        <GroupTitle>Atajos · personalizables</GroupTitle>
        {!isDefaultShortcuts(keys) && (
          <button
            type="button"
            onClick={() => {
              resetShortcuts()
              setEditing(null)
            }}
            className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted outline-none transition-colors hover:bg-black/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <RotateCcw size={11} />
            Restablecer
          </button>
        )}
      </div>
      {SHORTCUT_ACTIONS.map((a) => {
        const active = editing === a.id
        return (
          <div key={a.id} className="flex items-center gap-3 px-2.5 py-0.5 text-[12.5px] leading-snug text-ink">
            <span className="flex-1">{a.label}</span>
            <button
              type="button"
              aria-label={`Cambiar la tecla de ${a.label}`}
              onClick={() => setEditing(active ? null : a.id)}
              className={`${KEY_CLASS} min-w-6 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                active ? 'bg-accent text-white' : 'bg-accent-soft text-accent hover:bg-accent/20'
              }`}
            >
              {active ? 'Pulsa una tecla…' : shortcutLabel(keys[a.id])}
            </button>
          </div>
        )
      })}
      <p className="px-2.5 pt-1.5 text-[11.5px] leading-snug text-muted">
        Haz clic en una tecla y pulsa la nueva. Si ya estaba en uso, se intercambian. Se guarda en este navegador.
      </p>
    </section>
  )
}

/** Every keyboard and mouse control in one place; the single-key shortcuts can be changed. */
export const ControlsMenu = () => (
  <Popover
    align="right"
    trigger={({ open, toggle }) => (
      <IconButton label="Controles" active={open} onClick={toggle}>
        <Keyboard size={18} />
      </IconButton>
    )}
  >
    {() => (
      <div className="max-h-[calc(100vh-5rem)] w-80 overflow-y-auto">
        <Shortcuts />
        {FIXED.map((g) => (
          <section key={g.title} className="pb-1.5">
            <GroupTitle>{g.title}</GroupTitle>
            {g.controls.map((c) => (
              <div key={c.keys} className="flex items-start gap-3 px-2.5 py-1 text-[12.5px] leading-snug text-ink">
                <span className="flex-1">{c.action}</span>
                <kbd className={`${KEY_CLASS} bg-accent-soft text-accent`}>{c.keys}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    )}
  </Popover>
)
