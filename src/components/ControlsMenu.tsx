import { Keyboard } from 'lucide-react'
import { TOOLS } from './Toolbar'
import { IconButton } from './ui/IconButton'
import { Popover } from './ui/Popover'

interface Control {
  keys: string
  action: string
}

const GROUPS: { title: string; controls: Control[] }[] = [
  {
    title: 'Herramientas',
    controls: [
      ...TOOLS.map((t) => ({ keys: t.shortcut, action: t.label })),
      { keys: 'F', action: 'Voltear la escuadra o el cartabón' },
      { keys: 'Z', action: 'Lupa de precisión' },
    ],
  },
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
      { keys: 'Supr', action: 'Borra la selección' },
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
      { keys: 'Ctrl O', action: 'Abrir PDF o proyecto' },
    ],
  },
]

/** Every keyboard and mouse control in one place, for reference only. */
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
        {GROUPS.map((g) => (
          <section key={g.title} className="pb-1.5">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">{g.title}</p>
            {g.controls.map((c) => (
              <div key={c.keys} className="flex items-start gap-3 px-2.5 py-1 text-[12.5px] leading-snug text-ink">
                <span className="flex-1">{c.action}</span>
                <kbd className="shrink-0 rounded-[5px] bg-accent-soft px-1.5 py-px font-sans text-[10.5px] font-semibold text-accent">
                  {c.keys}
                </kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    )}
  </Popover>
)
