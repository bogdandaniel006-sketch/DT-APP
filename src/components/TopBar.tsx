import { Check, ChevronDown, Download, FileText, FolderOpen, House, Image, Magnet, Maximize, Redo2, Save, ScanSearch, TriangleAlert, Undo2 } from 'lucide-react'
import { detectionStore, detectionSummary } from '../pdf/detect'
import type { SnapMode } from '../types'
import { useState } from 'react'
import { goToStart, loadPdfFile, saveProject } from '../state/actions'
import { appStore, viewActions, zoomPercent } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions, documentStore } from '../state/documentStore'
import { shortcutLabel, shortcutStore } from '../state/shortcuts'
import { pickPdf } from '../utils/filePicker'
import { ControlsMenu } from './ControlsMenu'
import { Credit } from './Credit'
import { Logo } from './Logo'
import { IconButton } from './ui/IconButton'
import { MenuItem, Popover } from './ui/Popover'
import { Tooltip } from './ui/Tooltip'

const ZOOM_PRESETS = [100, 150, 200]

const visibleShapes = () => {
  const { hiddenLayers } = appStore.get()
  return documentStore.get().shapes.filter((s) => !hiddenLayers.includes(s.layer))
}

export const openPdfDialog = async () => {
  const file = await pickPdf()
  if (file) await loadPdfFile(file)
}

const SaveMenu = () => {
  const savedAt = useStore(appStore, (s) => s.savedAt)
  const saveFailed = useStore(appStore, (s) => s.saveFailed)
  const [busy, setBusy] = useState(false)

  const run = async (job: () => Promise<void>) => {
    setBusy(true)
    try {
      await job()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      align="right"
      trigger={({ open, toggle }) => (
        <IconButton label="Guardar y exportar" active={open} onClick={toggle} disabled={busy}>
          <Download size={18} />
        </IconButton>
      )}
    >
      {(close) => (
        <div className="w-60">
          <MenuItem
            icon={<FileText size={16} />}
            label="Exportar PDF"
            hint="original + trazos"
            onSelect={() => {
              close()
              void run(async () => (await import('../pdf/exportPdf')).exportPdf(visibleShapes()))
            }}
          />
          <MenuItem
            icon={<Image size={16} />}
            label="Exportar PNG"
            hint="página actual"
            onSelect={() => {
              close()
              const { page, pdfVisible } = appStore.get()
              void run(async () => (await import('../pdf/exportPng')).exportPng(visibleShapes(), page, pdfVisible))
            }}
          />
          <MenuItem
            icon={<Save size={16} />}
            label="Guardar proyecto"
            hint="editable"
            onSelect={() => {
              close()
              saveProject()
            }}
          />
          <div className="mx-2 my-1 h-px bg-black/[0.06]" />
          {saveFailed ? (
            <p className="flex items-start gap-1.5 px-2.5 py-1.5 text-[11.5px] leading-snug text-red-600">
              <TriangleAlert size={13} className="mt-px shrink-0" />
              El guardado automático ha fallado. Guarda el proyecto para no perder tu trabajo.
            </p>
          ) : (
            <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] text-muted">
              <Check size={13} className="text-accent" />
              {savedAt ? 'Tu trabajo se guarda automáticamente' : 'Se guardará automáticamente'}
            </p>
          )}
          <div className="mx-2 my-1 h-px bg-black/[0.06]" />
          <p className="flex px-2.5 pb-1 pt-1.5">
            <Credit className="text-[11.5px]" />
          </p>
        </div>
      )}
    </Popover>
  )
}

const SNAP_MODES: { mode: SnapMode; label: string; hint: string }[] = [
  { mode: 'preciso', label: 'Preciso', hint: 'Engancha fuerte, prioriza puntos e intersecciones' },
  { mode: 'normal', label: 'Normal', hint: 'Engancha a puntos, líneas y curvas cercanas' },
  { mode: 'libre', label: 'Libre', hint: 'Sin enganche' },
]

/** What the snapping found in the PDF of the current page, said in one line. */
const DetectionStatus = () => {
  const page = useStore(appStore, (s) => s.page)
  const pending = useStore(detectionStore, (s) => s.pending)
  useStore(detectionStore, (s) => s.pages)
  const summary = detectionSummary(page)
  let text: string
  if (!summary) text = pending > 0 ? 'Analizando el PDF…' : 'Sin análisis del PDF'
  else if (summary.source === 'none') text = 'No se ha encontrado geometría en esta página'
  else {
    const parts = [
      summary.points && `${summary.points} puntos`,
      summary.lines && `${summary.lines} líneas`,
      summary.circles && `${summary.circles} curvas`,
      summary.intersections && `${summary.intersections} intersecciones`,
    ].filter(Boolean)
    text = `${summary.source === 'raster' ? 'Escaneado · ' : ''}${parts.join(' · ')}`
  }
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] leading-snug text-muted" data-testid="detection-status">
      <span className="font-medium text-ink/70">PDF:</span> {text}
    </p>
  )
}

const SnapMenu = () => {
  const mode = useStore(appStore, (s) => s.snapMode)
  const current = SNAP_MODES.find((m) => m.mode === mode)!
  return (
    <Popover
      align="right"
      trigger={({ open, toggle }) => (
        <Tooltip label="Enganche a la geometría">
          <button
            type="button"
            onClick={toggle}
            aria-label={`Enganche: ${current.label}`}
            className={`flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
              open ? 'bg-accent-soft text-accent' : mode === 'libre' ? 'text-faint hover:bg-black/[0.035]' : 'text-ink/80 hover:bg-black/[0.035]'
            }`}
          >
            <Magnet size={16} className={mode === 'libre' ? '' : 'text-accent'} />
            {current.label}
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div className="w-72">
          {SNAP_MODES.map((m) => (
            <MenuItem
              key={m.mode}
              icon={m.mode === mode ? <Check size={15} strokeWidth={2.4} /> : <span className="block w-[15px]" />}
              label={m.label}
              description={m.hint}
              checked={m.mode === mode}
              onSelect={() => {
                appStore.set({ snapMode: m.mode })
                close()
              }}
            />
          ))}
          <div className="mx-2 my-1 h-px bg-black/[0.06]" />
          <DetectionStatus />
        </div>
      )}
    </Popover>
  )
}

const ZoomMenu = () => {
  const view = useStore(appStore, (s) => s.view)
  return (
    <Popover
      align="right"
      trigger={({ open, toggle }) => (
        <Tooltip label="Zoom" shortcut="Ctrl + rueda">
          <button
            type="button"
            onClick={toggle}
            aria-label="Zoom"
            className={`flex h-9 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${open ? 'bg-accent-soft text-accent' : 'text-ink/80 hover:bg-black/[0.035]'}`}
          >
            {zoomPercent(view)}%
            <ChevronDown size={14} className="opacity-60" />
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div className="w-52">
          <MenuItem
            icon={<Maximize size={15} />}
            label="Ajustar página"
            hint="Ctrl 0"
            onSelect={() => {
              viewActions.fitPage()
              close()
            }}
          />
          {ZOOM_PRESETS.map((z) => (
            <MenuItem
              key={z}
              label={`${z}%`}
              hint={z === 100 ? 'Ctrl 1' : undefined}
              checked={zoomPercent(view) === z}
              icon={<span className="block w-[15px]" />}
              onSelect={() => {
                viewActions.setPercent(z)
                close()
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  )
}

const LoupeToggle = () => {
  const loupe = useStore(appStore, (s) => s.loupe)
  const key = useStore(shortcutStore, (s) => s.keys.loupe)
  return (
    <IconButton label={loupe ? 'Lupa de precisión: activada' : 'Lupa de precisión'} shortcut={shortcutLabel(key)} active={loupe} onClick={() => appStore.set({ loupe: !loupe })}>
      <ScanSearch size={18} />
    </IconButton>
  )
}

export const TopBar = () => {
  const fileName = useStore(appStore, (s) => s.fileName)
  const saveFailed = useStore(appStore, (s) => s.saveFailed)
  const canUndo = useStore(documentStore, (s) => s.past.length > 0)
  const canRedo = useStore(documentStore, (s) => s.future.length > 0)

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-1 bg-white px-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_4px_18px_rgba(15,23,42,0.04)]">
      <Logo />
      {fileName && (
        <span className="ml-3 max-w-[32vw] truncate text-[12.5px] text-muted" title={fileName}>
          {fileName}
        </span>
      )}
      <div className="ml-3 flex items-center gap-0.5">
        <IconButton label="Menú principal" onClick={goToStart}>
          <House size={18} />
        </IconButton>
        <IconButton label="Abrir PDF o proyecto" shortcut="Ctrl O" onClick={() => void openPdfDialog()}>
          <FolderOpen size={18} />
        </IconButton>
        <SaveMenu />
      </div>
      {saveFailed && (
        <button
          type="button"
          onClick={saveProject}
          className="ml-2 flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-red-50 px-2.5 text-[12px] font-medium text-red-600 outline-none transition-colors hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-400/40"
        >
          <TriangleAlert size={15} />
          No se está guardando · Descargar copia
        </button>
      )}
      <div className="ml-4 hidden lg:block">
        <Credit className="text-[12px] opacity-80" />
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <IconButton label="Deshacer" shortcut="Ctrl Z" disabled={!canUndo} onClick={documentActions.undo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Rehacer" shortcut="Ctrl ⇧ Z" disabled={!canRedo} onClick={documentActions.redo}>
          <Redo2 size={18} />
        </IconButton>
        <div className="mx-1.5 h-5 w-px bg-black/[0.07]" />
        <SnapMenu />
        <LoupeToggle />
        <div className="mx-1.5 h-5 w-px bg-black/[0.07]" />
        <ZoomMenu />
        <ControlsMenu />
      </div>
    </header>
  )
}
