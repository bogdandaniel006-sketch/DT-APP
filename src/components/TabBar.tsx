import { File, FolderOpen, Plus, X } from 'lucide-react'
import type { SheetFormat } from '../pdf/make'
import { activateTab, closeTab, newBlankSheet } from '../state/actions'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { baseName } from '../utils/download'
import { openPdfDialog } from './TopBar'
import { MenuItem, Popover } from './ui/Popover'
import { Tooltip } from './ui/Tooltip'

export const BLANK_SHEETS: { format: SheetFormat; label: string; hint: string }[] = [
  { format: 'a4-portrait', label: 'Hoja en blanco', hint: 'A4 vertical' },
  { format: 'a4-landscape', label: 'Hoja en blanco', hint: 'A4 horizontal' },
  { format: 'a3-landscape', label: 'Hoja en blanco', hint: 'A3 horizontal' },
]

/** The open documents, one tab each, and the way to open one more. They stay open until closed. */
export const TabBar = () => {
  const tabs = useStore(appStore, (s) => s.tabs)
  const active = useStore(appStore, (s) => s.activeTab)

  return (
    <div className="relative z-[25] flex h-9 shrink-0 items-end gap-1 bg-black/[0.025] px-3 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06)]">
      <div role="tablist" aria-label="Documentos abiertos" className="flex min-w-0 items-end gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const current = t.id === active
          const name = baseName(t.name)
          return (
            <div
              key={t.id}
              className={`group flex h-8 shrink-0 items-center rounded-t-[10px] pl-3 pr-1 text-[12.5px] transition-colors ${
                current
                  ? 'bg-white font-medium text-ink shadow-[0_-1px_0_rgba(15,23,42,0.05),1px_0_0_rgba(15,23,42,0.05),-1px_0_0_rgba(15,23,42,0.05)]'
                  : 'text-muted hover:bg-black/[0.04] hover:text-ink'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={current}
                title={name}
                onClick={() => void activateTab(t.id)}
                className="max-w-44 truncate outline-none focus-visible:underline"
              >
                {name}
              </button>
              <button
                type="button"
                aria-label={`Cerrar ${name}`}
                onClick={() => void closeTab(t.id)}
                className={`ml-1.5 grid h-5 w-5 place-items-center rounded-md outline-none transition-opacity hover:bg-black/[0.07] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  current ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-70'
                }`}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <Popover
        trigger={({ open, toggle }) => (
          <Tooltip label="Nueva pestaña">
            <button
              type="button"
              aria-label="Nueva pestaña"
              onClick={toggle}
              className={`mb-1 grid h-6 w-6 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
                open ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-black/[0.05] hover:text-ink'
              }`}
            >
              <Plus size={15} />
            </button>
          </Tooltip>
        )}
      >
        {(close) => (
          <div className="w-60">
            {BLANK_SHEETS.map((s) => (
              <MenuItem
                key={s.format}
                icon={<File size={16} />}
                label={s.label}
                hint={s.hint}
                onSelect={() => {
                  close()
                  void newBlankSheet(s.format)
                }}
              />
            ))}
            <div className="mx-2 my-1 h-px bg-black/[0.06]" />
            <MenuItem
              icon={<FolderOpen size={16} />}
              label="Abrir archivo"
              hint="PDF, imagen, .lamina"
              onSelect={() => {
                close()
                void openPdfDialog()
              }}
            />
          </div>
        )}
      </Popover>
    </div>
  )
}
