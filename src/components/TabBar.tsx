import { File, FolderOpen, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SheetFormat } from '../pdf/make'
import { activateTab, closeTab, newBlankSheet, renameTab } from '../state/actions'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { baseName } from '../utils/download'
import { openPdfDialog } from './TopBar'
import { MenuItem, Popover } from './ui/Popover'
import { Segmented } from './ui/Segmented'
import { Tooltip } from './ui/Tooltip'

export const BLANK_SHEETS: { format: SheetFormat; label: string; hint: string }[] = [
  { format: 'a4-portrait', label: 'Hoja en blanco', hint: 'A4 vertical' },
  { format: 'a4-landscape', label: 'Hoja en blanco', hint: 'A4 horizontal' },
  { format: 'a3-landscape', label: 'Hoja en blanco', hint: 'A3 horizontal' },
]

/** The blank sheets of the new-tab menu: white, unless black is picked for that one. */
const BlankSheets = ({ close }: { close: () => void }) => {
  const [dark, setDark] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-2.5 pb-1.5 pt-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Hoja</span>
        <Segmented<'blanca' | 'negra'>
          label="Color de la hoja"
          value={dark ? 'negra' : 'blanca'}
          options={[
            { value: 'blanca', label: 'Blanca' },
            { value: 'negra', label: 'Negra' },
          ]}
          onChange={(v) => setDark(v === 'negra')}
        />
      </div>
      {BLANK_SHEETS.map((s) => (
        <MenuItem
          key={s.format}
          icon={<File size={16} className={dark ? 'fill-current' : ''} />}
          label={dark ? 'Hoja negra' : s.label}
          hint={s.hint}
          onSelect={() => {
            close()
            void newBlankSheet(s.format, dark)
          }}
        />
      ))}
    </>
  )
}

/** The name of a tab being changed: Enter or a click elsewhere keeps it, Esc leaves it as it was. */
const TabName = ({ name, onDone }: { name: string; onDone: (typed: string | null) => void }) => {
  const [value, setValue] = useState(name)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  return (
    <input
      ref={input}
      value={value}
      aria-label="Nombre de la pestaña"
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') onDone(value)
        if (e.key === 'Escape') onDone(null)
      }}
      style={{ width: `${Math.min(Math.max(value.length, 6), 32) + 1}ch` }}
      className="h-6 rounded-md bg-white px-1.5 text-[12.5px] font-medium text-ink outline-none ring-2 ring-accent/50"
    />
  )
}

/** The open documents, one tab each, and the way to open one more. They stay open until closed. */
export const TabBar = () => {
  const tabs = useStore(appStore, (s) => s.tabs)
  const active = useStore(appStore, (s) => s.activeTab)
  const [renaming, setRenaming] = useState<string | null>(null)

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
              {renaming === t.id ? (
                <TabName
                  name={name}
                  onDone={(typed) => {
                    if (typed !== null) renameTab(t.id, typed)
                    setRenaming(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={current}
                  title={`${name} · doble clic para cambiar el nombre`}
                  onClick={() => void activateTab(t.id)}
                  onDoubleClick={() => setRenaming(t.id)}
                  className="max-w-44 truncate outline-none focus-visible:underline"
                >
                  {name}
                </button>
              )}
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
            <BlankSheets close={close} />
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
