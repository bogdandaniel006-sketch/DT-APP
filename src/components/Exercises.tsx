import { ArrowLeft, BookOpen, Box, ChevronRight, Eye, Globe, GraduationCap, Mountain, Ruler, Search, Shapes, Triangle, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  EXERCISE_SOURCE,
  EXERCISE_TOPICS,
  OTHER_SOURCES,
  OTHER_TOPICS,
  exerciseLocalUrl,
  exerciseUrl,
  type Exercise,
  type ExerciseGroup,
  type ExerciseSource,
  type ExerciseTopic,
} from '../data/exercises'
import { loadPdfFromUrl } from '../state/actions'
import { IconButton } from './ui/IconButton'

/** A drawing for each topic's square; topics without one get the book. */
const TOPIC_ICONS: Record<string, ReactNode> = {
  'Geometría plana': <Triangle size={26} strokeWidth={1.6} />,
  'Sistema Diédrico': <Shapes size={26} strokeWidth={1.6} />,
  'Sistema Axonométrico': <Box size={26} strokeWidth={1.6} />,
  'Perspectiva cónica': <Eye size={26} strokeWidth={1.6} />,
  'Planos acotados': <Mountain size={26} strokeWidth={1.6} />,
  Normalización: <Ruler size={26} strokeWidth={1.6} />,
  'Pruebas de acceso · Madrid': <GraduationCap size={26} strokeWidth={1.6} />,
  'Vistas de piezas': <Box size={26} strokeWidth={1.6} />,
  'Perspectivas: isométrica y caballera': <Eye size={26} strokeWidth={1.6} />,
  'Normalización y acotación': <Ruler size={26} strokeWidth={1.6} />,
  'Sistema diédrico': <Shapes size={26} strokeWidth={1.6} />,
  'Perspectiva cónica y sólidos': <Mountain size={26} strokeWidth={1.6} />,
}

const SIDE_BUTTON =
  'flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent-soft px-3 text-[12.5px] font-medium text-accent outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/40'

const count = (topic: ExerciseTopic) => topic.groups.reduce((n, g) => n + g.exercises.length, 0)

/** Site a group of sheets comes from: its own, its topic's, or the main library. */
const sourceOf = (topic: ExerciseTopic, group?: ExerciseGroup) => group?.source ?? topic.source ?? EXERCISE_SOURCE

/** Sites a topic draws from, each once. */
const sitesOf = (topic: ExerciseTopic) => [...new Set(topic.groups.map((g) => sourceOf(topic, g).site))]

/** A sheet and the site it comes from. */
interface Sheet {
  exercise: Exercise
  source: ExerciseSource
}

/** "doc/tangencias-apolonio.pdf" → "tangencias-apolonio.pdf": the name the sheet has at its source. */
const fileName = (exercise: Exercise) => exercise.file.split('/').pop() ?? exercise.file

/** Lower case and without accents, so "diedrico" finds "Diédrico". */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

interface Found extends Sheet {
  /** Topic and group of the sheet (and its site, outside the main library). */
  where: string
}

/** Sheets of the given topics whose name, group, topic or site contain every word of the query. */
const search = (query: string, topics: readonly ExerciseTopic[]): Found[] => {
  const words = plain(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const found: Found[] = []
  for (const t of topics) {
    // Topics of a single site name it first; in the others each group's title already does.
    const site = t.source ? `${t.source.site} · ` : ''
    for (const g of t.groups) {
      const source = sourceOf(t, g)
      const where = `${site}${t.title} · ${g.title}`
      for (const x of g.exercises) {
        const text = plain(`${source.site} ${where} ${x.name}`)
        if (words.every((w) => text.includes(w))) found.push({ exercise: x, source, where })
      }
    }
  }
  return found
}

/**
 * The library: a search box, a square per topic, then the sheets of the chosen topic as an index.
 * The main library is dtecnico.com; sheets from other sites live apart, behind their own button.
 */
const ExercisesPanel = ({ onClose }: { onClose: () => void }) => {
  /** Looking at the other sites instead of the main library. */
  const [others, setOthers] = useState(false)
  const [topic, setTopic] = useState<ExerciseTopic | null>(null)
  const [opening, setOpening] = useState<Exercise | null>(null)
  const [failed, setFailed] = useState<Sheet | null>(null)
  const [query, setQuery] = useState('')

  const topics = others ? OTHER_TOPICS : EXERCISE_TOPICS

  /** Moves between the main library and the other sites; what was typed keeps searching there. */
  const show = (otherSites: boolean) => {
    setOthers(otherSites)
    setTopic(null)
    setFailed(null)
  }

  // While the panel is open the keyboard belongs to it: Esc steps back, tool shortcuts stay quiet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (query) setQuery('')
      else if (topic) setTopic(null)
      else if (others) setOthers(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [topic, query, others, onClose])

  /** Puts the sheet on the desk, ready to draw on. */
  const open = async (sheet: Sheet) => {
    if (opening) return
    setOpening(sheet.exercise)
    setFailed(null)
    const ok = await loadPdfFromUrl(exerciseLocalUrl(sheet.exercise, sheet.source), fileName(sheet.exercise))
    setOpening(null)
    if (ok) onClose()
    else setFailed(sheet)
  }

  const found = search(query, topics)
  const searching = query.trim() !== ''

  /** A sheet of the index; search results also say where it belongs. */
  const sheetRow = (sheet: Sheet, key: string, where?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => void open(sheet)}
      disabled={opening !== null}
      className="flex w-full break-inside-avoid items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none transition-colors hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ink"
    >
      <span className="min-w-0 flex-1">
        {sheet.exercise.name}
        {where && <span className="block truncate text-[11.5px] text-muted">{where}</span>}
      </span>
      {opening === sheet.exercise ? (
        <span className="shrink-0 text-[11px] font-medium text-accent">Abriendo…</span>
      ) : (
        <ChevronRight size={15} className="shrink-0 text-faint" />
      )}
    </button>
  )

  const credit = (source: ExerciseSource) => (
    <>
      {source.title}
      {source.author && ` — ${source.author}`}
      {source.licence && ` (${source.licence})`}
    </>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/20 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Ejercicios para practicar"
        className="animate-pop flex max-h-full w-full max-w-4xl flex-col rounded-3xl bg-white shadow-[0_10px_36px_rgba(15,23,42,0.14)]"
      >
        <header className="flex items-center gap-2 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          {topic ? (
            <IconButton label="Volver a los temas" onClick={() => setTopic(null)}>
              <ArrowLeft size={18} />
            </IconButton>
          ) : (
            others && (
              <IconButton label="Volver a la biblioteca" onClick={() => show(false)}>
                <ArrowLeft size={18} />
              </IconButton>
            )
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-faint">
              {topic ? (others ? (topic.source?.site ?? 'Varias webs') : 'Ejercicios para practicar') : 'Elige un tema'}
            </p>
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
              {topic ? topic.title : others ? 'Ejercicios de otras webs' : 'Ejercicios para practicar'}
            </h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="mx-4 mb-2 flex gap-2 sm:mx-6">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/[0.04] px-3 text-muted transition-colors focus-within:bg-accent-soft focus-within:text-accent">
            <Search size={16} className="shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={others ? 'Buscar en las otras webs: vistas, afinidad, PAU…' : 'Buscar una ficha: tangencias, abatimiento, 2023…'}
              aria-label="Buscar una ficha"
              spellCheck={false}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                aria-label="Borrar la búsqueda"
                onClick={() => setQuery('')}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <X size={14} />
              </button>
            )}
          </label>
          {others ? (
            <button type="button" onClick={() => show(false)} aria-label="Volver a la biblioteca" className={SIDE_BUTTON}>
              <BookOpen size={16} />
              <span className="hidden sm:inline">Biblioteca principal</span>
            </button>
          ) : (
            <button type="button" onClick={() => show(true)} aria-label="Buscar en otras webs" className={SIDE_BUTTON}>
              <Globe size={16} />
              <span className="hidden sm:inline">Buscar en otras webs</span>
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          {failed && (
            <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] leading-snug text-red-600">
              No se ha podido traer «{failed.exercise.name}» a la mesa.{' '}
              <a
                href={exerciseUrl(failed.exercise, failed.source)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Abrir el PDF original
              </a>
            </p>
          )}
          {searching ? (
            found.length ? (
              <div className="gap-x-6 sm:columns-2">{found.map((f) => sheetRow(f, `${f.where}/${f.exercise.file}`, f.where))}</div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-2.5 py-8 text-center text-[13px] text-muted">
                <p>
                  Ninguna ficha {others ? 'de las otras webs' : 'de la biblioteca'} coincide con «{query.trim()}».
                </p>
                {!others && (
                  <button type="button" onClick={() => show(true)} className={SIDE_BUTTON}>
                    <Globe size={15} />
                    Buscarlo en otras webs
                  </button>
                )}
              </div>
            )
          ) : topic ? (
            <div className="gap-x-6 sm:columns-2 lg:columns-3">
              {topic.groups.map((g) => (
                <div key={g.title} className="mb-2 break-inside-avoid">
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-faint">{g.title}</p>
                  {g.exercises.map((x) => sheetRow({ exercise: x, source: sourceOf(topic, g) }, x.file))}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4">
              {topics.map((t) => (
                <button
                  key={`${sourceOf(t).id}/${t.title}`}
                  type="button"
                  onClick={() => {
                    setFailed(null)
                    setTopic(t)
                  }}
                  className="group flex aspect-square flex-col justify-between rounded-2xl bg-black/[0.03] p-4 text-left outline-none transition-all duration-200 hover:-translate-y-px hover:bg-accent-soft hover:shadow-[var(--shadow-float)] focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-accent shadow-[0_1px_4px_rgba(15,23,42,0.08)]">
                    {TOPIC_ICONS[t.title] ?? <BookOpen size={26} strokeWidth={1.6} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink group-hover:text-accent">
                      {t.title}
                    </span>
                    {others && (
                      <span className="mt-1 block truncate text-[12px] font-medium text-accent">
                        {t.source ? t.source.site : `${sitesOf(t).length} webs`}
                      </span>
                    )}
                    <span className="mt-1 block text-[12px] tabular-nums text-muted">{count(t)} fichas</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-black/[0.06] px-4 py-2.5 text-[11.5px] leading-snug text-muted sm:px-6">
          {others && !topic ? (
            <>
              <p>Ejercicios y materiales de {OTHER_SOURCES.length} webs; cada ficha pertenece a su web de origen.</p>
              <p>Dentro de cada tema se indica de qué web es cada grupo de fichas.</p>
            </>
          ) : topic && !topic.source && others ? (
            <>
              <p>Ejercicios y materiales de varias webs; cada ficha pertenece a su web de origen.</p>
              <p>Fuentes: {sitesOf(topic).join(' · ')}</p>
            </>
          ) : (
            <>
              <p>Ejercicios y materiales de referencia: {credit(topic ? sourceOf(topic) : EXERCISE_SOURCE)}</p>
              <p>Fuente: {(topic ? sourceOf(topic) : EXERCISE_SOURCE).site}</p>
            </>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

/** Entry to the exercise library: a full button on the start screen, a labelled one on the desk. */
export const ExercisesButton = ({ variant }: { variant: 'start' | 'bar' }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'bar' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ejercicios para practicar"
          className={`ml-1 flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 ${
            open ? 'bg-accent text-white' : 'bg-accent-soft text-accent hover:bg-accent/20'
          }`}
        >
          <BookOpen size={16} />
          <span className="hidden sm:inline">Ejercicios</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex h-12 items-center gap-2.5 rounded-2xl bg-accent px-6 text-[15px] font-medium text-white shadow-[var(--shadow-float)] outline-none transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-float-hover)] focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BookOpen size={18} />
          Ejercicios para practicar
        </button>
      )}
      {open && <ExercisesPanel onClose={() => setOpen(false)} />}
    </>
  )
}
