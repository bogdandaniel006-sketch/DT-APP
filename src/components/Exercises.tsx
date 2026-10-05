import { ArrowLeft, BookOpen, Box, ChevronRight, Eye, GraduationCap, Mountain, Ruler, Shapes, Triangle, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  EXERCISE_SOURCE,
  EXERCISE_TOPICS,
  exerciseLocalUrl,
  exerciseUrl,
  type Exercise,
  type ExerciseTopic,
} from '../data/exercises'
import { loadPdfFromUrl } from '../state/actions'
import { IconButton } from './ui/IconButton'

/** A drawing for each topic's square; topics added later get the book. */
const TOPIC_ICONS: Record<string, ReactNode> = {
  'Geometría plana': <Triangle size={26} strokeWidth={1.6} />,
  'Sistema Diédrico': <Shapes size={26} strokeWidth={1.6} />,
  'Sistema Axonométrico': <Box size={26} strokeWidth={1.6} />,
  'Perspectiva cónica': <Eye size={26} strokeWidth={1.6} />,
  'Planos acotados': <Mountain size={26} strokeWidth={1.6} />,
  Normalización: <Ruler size={26} strokeWidth={1.6} />,
  'Pruebas de acceso · Madrid': <GraduationCap size={26} strokeWidth={1.6} />,
}

const count = (topic: ExerciseTopic) => topic.groups.reduce((n, g) => n + g.exercises.length, 0)

/** "doc/tangencias-apolonio.pdf" → "tangencias-apolonio.pdf": the name the sheet has at its source. */
const fileName = (exercise: Exercise) => exercise.file.split('/').pop() ?? exercise.file

/** The library: a square per topic, then the sheets of the chosen topic as an index. */
const ExercisesPanel = ({ onClose }: { onClose: () => void }) => {
  const [topic, setTopic] = useState<ExerciseTopic | null>(null)
  const [opening, setOpening] = useState<Exercise | null>(null)
  const [failed, setFailed] = useState<Exercise | null>(null)

  // While the panel is open the keyboard belongs to it: Esc steps back, tool shortcuts stay quiet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key !== 'Escape') return
      if (topic) setTopic(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [topic, onClose])

  /** Puts the sheet on the desk, ready to draw on. */
  const open = async (exercise: Exercise) => {
    if (opening) return
    setOpening(exercise)
    setFailed(null)
    const ok = await loadPdfFromUrl(exerciseLocalUrl(exercise), fileName(exercise))
    setOpening(null)
    if (ok) onClose()
    else setFailed(exercise)
  }

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
          {topic && (
            <IconButton label="Volver a los temas" onClick={() => setTopic(null)}>
              <ArrowLeft size={18} />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
              {topic ? 'Ejercicios para practicar' : 'Elige un tema'}
            </p>
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
              {topic ? topic.title : 'Ejercicios para practicar'}
            </h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
          {topic ? (
            <>
              {failed && (
                <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] leading-snug text-red-600">
                  No se ha podido traer «{failed.name}» a la mesa.{' '}
                  <a href={exerciseUrl(failed)} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                    Abrir el PDF original
                  </a>
                </p>
              )}
              <div className="gap-x-6 sm:columns-2 lg:columns-3">
                {topic.groups.map((g) => (
                  <div key={g.title} className="mb-2 break-inside-avoid">
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-faint">{g.title}</p>
                    {g.exercises.map((x) => (
                      <button
                        key={x.file}
                        type="button"
                        onClick={() => void open(x)}
                        disabled={opening !== null}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none transition-colors hover:bg-accent-soft hover:text-accent focus-visible:bg-accent-soft disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-ink"
                      >
                        <span className="flex-1">{x.name}</span>
                        {opening === x ? (
                          <span className="shrink-0 text-[11px] font-medium text-accent">Abriendo…</span>
                        ) : (
                          <ChevronRight size={15} className="shrink-0 text-faint" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4">
              {EXERCISE_TOPICS.map((t) => (
                <button
                  key={t.title}
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
                  <span>
                    <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink group-hover:text-accent">
                      {t.title}
                    </span>
                    <span className="mt-1 block text-[12px] tabular-nums text-muted">{count(t)} fichas</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-black/[0.06] px-4 py-2.5 text-[11.5px] leading-snug text-muted sm:px-6">
          <p>
            Ejercicios y materiales de referencia: {EXERCISE_SOURCE.title} — {EXERCISE_SOURCE.author}
          </p>
          <p>
            Fuente:{' '}
            <a
              href={EXERCISE_SOURCE.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent outline-none hover:underline focus-visible:underline"
            >
              {EXERCISE_SOURCE.site}
            </a>
          </p>
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
