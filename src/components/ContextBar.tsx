import { EyeOff, FlipVertical2, Pencil as PencilIcon, Ruler, Trash2, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { measurements, shapeName } from '../geometry/shapes'
import { appStore, flipInstrument, hideInstrument, setTool } from '../state/appStore'
import { useStore } from '../state/createStore'
import { documentActions, documentStore } from '../state/documentStore'
import { shortcutLabel, shortcutStore } from '../state/shortcuts'
import { toolTick, tools } from '../tools/registry'
import { isGeometry, isText, type Pencil, type PencilHardness, type PencilWidth, type ToolId } from '../types'
import { distance } from '../geometry/primitives'
import { pageOffset } from '../geometry/layout'
import { MAX_TEXT_LENGTH } from '../geometry/text'
import { add } from '../geometry/vec'
import { MAX_NAME_LENGTH, normalizePointName } from '../utils/pointNames'
import { formatCoordinate, formatLength } from '../utils/format'
import { dimensionFigure } from '../canvas/dimension'
import { PENCIL_COLORS } from '../canvas/style'
import { Popover } from './ui/Popover'
import { Segmented } from './ui/Segmented'
import { Tooltip } from './ui/Tooltip'

const PENCIL_TOOLS: readonly ToolId[] = ['point', 'text', 'dimension', 'line', 'perpendicular', 'parallel', 'bisector', 'compass', 'arc', 'escuadra', 'cartabon']

const WIDTHS = [
  { value: 0.25, label: '0,25' },
  { value: 0.35, label: '0,35' },
  { value: 0.5, label: '0,50' },
] as const
const HARDNESS = [
  { value: '2H', label: '2H' },
  { value: 'H', label: 'H' },
  { value: 'HB', label: 'HB' },
] as const
const STROKES = [
  { value: 'solid', label: 'Continua' },
  { value: 'dashed', label: 'Discontinua' },
] as const

/** How graphite shows in the colour picker (the real shade depends on the lead). */
const GRAPHITE_SWATCH = '#1F2329'

const Divider = () => <div className="h-5 w-px bg-black/[0.07]" />

const SWATCH = 'h-5 w-5 rounded-full outline-none ring-offset-2 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent/60'

/** Colour of the stroke, tucked behind a small dot: graphite unless another is picked by hand. */
const ColorPicker = ({ color, onChange }: { color: string | undefined; onChange: (color: string | undefined) => void }) => (
  <Popover
    side="top"
    align="right"
    trigger={({ toggle }) => (
      <Tooltip label="Color del trazo" side="top">
        <button
          type="button"
          aria-label="Color del trazo"
          onClick={toggle}
          className="grid h-7 w-7 place-items-center rounded-lg outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: color ?? GRAPHITE_SWATCH }} />
        </button>
      </Tooltip>
    )}
  >
    {(close) => (
      <div className="flex items-center gap-2 px-1.5 py-1">
        {[{ value: undefined, label: 'Grafito' }, ...PENCIL_COLORS].map((c) => (
          <button
            key={c.label}
            type="button"
            aria-label={c.label}
            title={c.label}
            onClick={() => {
              onChange(c.value)
              close()
            }}
            className={`${SWATCH} ${c.value === color ? 'ring-2 ring-accent' : ''}`}
            style={{ background: c.value ?? GRAPHITE_SWATCH }}
          />
        ))}
      </div>
    )}
  </Popover>
)

const PencilPicker = ({ pencil, onChange }: { pencil: Pencil; onChange: (p: Pencil) => void }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[11px] font-medium uppercase tracking-wider text-faint">Lápiz</span>
    <Segmented<PencilWidth>
      label="Grosor"
      value={pencil.width}
      options={WIDTHS}
      onChange={(width) => onChange({ ...pencil, width })}
    />
    <Segmented<PencilHardness>
      label="Dureza"
      value={pencil.hardness}
      options={HARDNESS}
      onChange={(hardness) => onChange({ ...pencil, hardness })}
    />
    <Segmented<'solid' | 'dashed'>
      label="Trazo"
      value={pencil.dashed ? 'dashed' : 'solid'}
      options={STROKES}
      onChange={(stroke) => onChange({ ...pencil, dashed: stroke === 'dashed' })}
    />
    <ColorPicker color={pencil.color} onChange={(color) => onChange({ ...pencil, color })} />
  </div>
)

const TextButton = ({
  icon,
  children,
  onClick,
  tone,
  active,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  tone?: 'danger'
  active?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
      active
        ? 'bg-accent-soft text-accent'
        : tone === 'danger'
          ? 'text-ink/70 hover:bg-red-50 hover:text-red-600'
          : 'text-ink/70 hover:bg-black/[0.04] hover:text-ink'
    }`}
  >
    {icon}
    {children}
  </button>
)

const CompassOptions = ({ tool }: { tool: 'compass' | 'arc' }) => {
  const radius = useStore(appStore, (s) => s.compassRadius)
  const measuring = useStore(appStore, (s) => s.measuring)
  return (
    <>
      <Segmented<'compass' | 'arc'>
        label="Tipo"
        value={tool}
        options={[
          { value: 'compass', label: 'Circunferencia' },
          { value: 'arc', label: 'Arco' },
        ]}
        onChange={setTool}
      />
      <Divider />
      {radius ? (
        <div className="flex items-center gap-1 rounded-lg bg-accent-soft py-0.5 pl-2 pr-0.5 text-xs font-medium tabular-nums text-accent">
          <Ruler size={13} />
          Radio fijo {formatLength(radius)}
          <button
            type="button"
            aria-label="Olvidar medida"
            onClick={() => appStore.set({ compassRadius: null })}
            className="grid h-6 w-6 place-items-center rounded-md outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <Tooltip label="Copia una distancia AB para usarla como radio" side="top">
          <TextButton icon={<Ruler size={14} />} active={measuring} onClick={() => appStore.set({ measuring: !measuring })}>
            Tomar medida
          </TextButton>
        </Tooltip>
      )}
    </>
  )
}

/**
 * Name of the selected point, line or circle, or the words of a selected text. Edits commit on
 * Enter or when leaving the field (one undo step). A name can be emptied to remove it; a text cannot.
 */
const NameField = ({ id, name, writing, label = 'Nombre', placeholder }: { id: string; name: string; writing: boolean; label?: string; placeholder?: string }) => {
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [name, id])
  const commit = () => {
    const next = writing ? value.trim().slice(0, MAX_TEXT_LENGTH) : normalizePointName(value)
    if (next === name || (writing && !next)) return setValue(name)
    documentActions.update([id], (s) => ({ ...s, name: next || undefined }))
  }
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
      {writing ? 'Texto' : label}
      <input
        value={value}
        maxLength={writing ? MAX_TEXT_LENGTH : MAX_NAME_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setValue(name)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        spellCheck={false}
        aria-label={writing ? 'Texto' : label}
        placeholder={placeholder}
        data-testid="point-name-input"
        className={`h-7 rounded-md bg-black/[0.04] px-2 text-[13px] normal-case tracking-normal text-ink outline-none focus:bg-accent-soft focus:text-accent ${
          writing ? 'w-52 font-normal' : 'w-14 text-center font-semibold'
        }`}
      />
    </label>
  )
}

const Info = ({ children }: { children: ReactNode }) => (
  <span className="text-[12.5px] tabular-nums text-accent" data-testid="selection-info">
    {children}
  </span>
)

const SelectionInfo = ({ ids }: { ids: readonly string[] }) => {
  const shapes = useStore(documentStore, (s) => s.shapes)
  const selected = shapes.filter((s) => ids.includes(s.id))
  if (!selected.length) return null
  const first = selected[0]!
  const single = selected.length === 1
  const geometry = selected.filter(isGeometry)
  const samePencil = geometry.every(
    (s) =>
      s.pencil.width === first.pencil.width &&
      s.pencil.hardness === first.pencil.hardness &&
      !s.pencil.dashed === !first.pencil.dashed &&
      s.pencil.color === first.pencil.color,
  )
  // Contextual facts, read from the exact document coordinates.
  let info: string[] = single ? measurements(first) : []
  const writing = isText(first)
  if (single && first.kind === 'point') info = writing ? [] : [`X ${formatCoordinate(first.p.x)} mm`, `Y ${formatCoordinate(first.p.y)} mm`]
  if (single && (first.kind === 'circle' || first.kind === 'arc')) {
    const centre = shapes.find((s) => s.kind === 'point' && s.page === first.page && s.name && distance(s.p, first.c) < 1e-6)
    if (centre?.name) info = [`Centro ${centre.name}`, ...info]
  }
  return (
    <>
      <span className="text-[12.5px] font-medium text-ink">{single ? (writing ? 'Texto' : first.kind === 'segment' && first.dimension ? 'Cota' : shapeName(first)) : `${selected.length} elementos`}</span>
      {single && isGeometry(first) && !writing && (
        <NameField
          id={first.id}
          name={first.name ?? ''}
          writing={false}
          {...(first.kind === 'segment' && first.dimension && { label: 'Cifra', placeholder: dimensionFigure(first.a, first.b) })}
        />
      )}
      {single && first.kind === 'point' && writing && (
        <>
          <TextButton
            icon={<PencilIcon size={14} />}
            onClick={() => {
              // Its box opens on the sheet, where the text is.
              const { pageRects } = appStore.get()
              const p = add(first.p, pageOffset(pageRects, first.page))
              appStore.set({ tool: 'text', selection: [], naming: { p, id: first.id, value: first.name ?? '', text: true } })
            }}
          >
            Editar
          </TextButton>
        </>
      )}
      {info.length > 0 && <Info>{info.join(' · ')}</Info>}
      {geometry.length > 0 && (
        <>
          <Divider />
          <PencilPicker
            pencil={samePencil ? first.pencil : { width: 0.35, hardness: 'H' }}
            onChange={(pencil) => documentActions.update(geometry.map((s) => s.id), (s) => ({ ...s, pencil }))}
          />
        </>
      )}
      <Divider />
      <TextButton
        icon={<Trash2 size={14} />}
        tone="danger"
        onClick={() => {
          documentActions.remove(ids)
          appStore.set({ selection: [] })
        }}
      >
        Borrar
      </TextButton>
    </>
  )
}

const MeasureOptions = ({ tool }: { tool: 'measure-distance' | 'measure-angle' }) => (
  <Segmented<'measure-distance' | 'measure-angle'>
    label="Medir"
    value={tool}
    options={[
      { value: 'measure-distance', label: 'Distancia' },
      { value: 'measure-angle', label: 'Ángulo' },
    ]}
    onChange={setTool}
  />
)

/** Bottom bar: step hint plus the few options the current tool needs. Hidden otherwise. */
export const ContextBar = () => {
  const tool = useStore(appStore, (s) => s.tool)
  const pencil = useStore(appStore, (s) => s.pencil)
  const selection = useStore(appStore, (s) => s.selection)
  useStore(appStore, (s) => s.measuring)
  useStore(appStore, (s) => s.compassRadius)
  useStore(toolTick, (s) => s.n)
  const flipKey = useStore(shortcutStore, (s) => s.keys.flip)

  const hint = tools[tool].hint()
  const showSelection = tool === 'select' && selection.length > 0
  const showPencil = PENCIL_TOOLS.includes(tool)
  const measureTool = tool === 'measure-distance' || tool === 'measure-angle' ? tool : null
  const instrument = tool === 'escuadra' || tool === 'cartabon' ? tool : null

  if (!hint && !showSelection && !showPencil && !measureTool) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2">
      {hint && (
        <p
          key={hint}
          className="animate-pop rounded-full bg-white/85 px-3 py-1 text-[12px] text-muted shadow-[0_2px_10px_rgba(15,23,42,0.06)] backdrop-blur"
          data-testid="hint"
        >
          {hint}
        </p>
      )}
      {(showSelection || showPencil || measureTool) && (
        <div className="float pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2" data-testid="context-bar">
          {showSelection ? (
            <SelectionInfo ids={selection} />
          ) : measureTool ? (
            <MeasureOptions tool={measureTool} />
          ) : (
            <>
              <PencilPicker pencil={pencil} onChange={(p) => appStore.set({ pencil: p })} />
              {(tool === 'compass' || tool === 'arc') && (
                <>
                  <Divider />
                  <CompassOptions tool={tool} />
                </>
              )}
              {instrument && (
                <>
                  <Divider />
                  <Tooltip label="Darle la vuelta, como el de verdad" shortcut={shortcutLabel(flipKey)} side="top">
                    <TextButton icon={<FlipVertical2 size={14} />} onClick={() => flipInstrument(instrument)}>
                      Voltear
                    </TextButton>
                  </Tooltip>
                  <TextButton icon={<EyeOff size={14} />} onClick={() => hideInstrument(instrument)}>
                    Quitar {instrument === 'escuadra' ? 'escuadra' : 'cartabón'}
                  </TextButton>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
