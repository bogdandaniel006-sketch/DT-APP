import { ArrowLeft, BookOpen, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { EXERCISE_SOURCE, EXERCISE_TOPICS, exerciseUrl, type ExerciseTopic } from '../data/exercises'
import { IconButton } from './ui/IconButton'

const ROW =
  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink outline-none transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04]'

const count = (topic: ExerciseTopic) => topic.groups.reduce((n, g) => n + g.exercises.length, 0)

/** The library as an index: topics first, then the sheets of the chosen topic. */
const ExercisesPanel = ({ onClose }: { onClose: () => void }) => {
  const [topic, setTopic] = useState<ExerciseTopic | null>(null)

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/20 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Ejercicios"
        className="animate-pop flex max-h-[min(40rem,100%)] w-full max-w-md flex-col rounded-2xl bg-white shadow-[0_10px_36px_rgba(15,23,42,0.14)]"
      >
        <header className="flex items-center gap-1 px-2.5 pb-1 pt-2.5">
          {topic ? (
            <IconButton label="Volver a los temas" onClick={() => setTopic(null)}>
              <ArrowLeft size={18} />
            </IconButton>
          ) : (
            <span className="grid h-9 w-9 place-items-center text-accent">
              <BookOpen size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-faint">
              {topic ? 'Ejercicios' : 'Selecciona un tema'}
            </p>
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{topic ? topic.title : 'Ejercicios'}</h2>
          </div>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
          {topic
            ? topic.groups.map((g) => (
                <div key={g.title} className="pb-1">
                  <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">{g.title}</p>
                  {g.exercises.map((x) => (
                    <a key={x.file} href={exerciseUrl(x)} target="_blank" rel="noopener noreferrer" className={ROW}>
                      <span className="flex-1">{x.name}</span>
                      <ExternalLink size={14} className="shrink-0 text-faint" />
                    </a>
                  ))}
                </div>
              ))
            : EXERCISE_TOPICS.map((t) => (
                <button key={t.title} type="button" onClick={() => setTopic(t)} className={ROW}>
                  <span className="flex-1">{t.title}</span>
                  <span className="text-[11px] tabular-nums text-faint">{count(t)}</span>
                  <ChevronRight size={15} className="shrink-0 text-faint" />
                </button>
              ))}
        </div>

        <footer className="border-t border-black/[0.06] px-5 py-2.5 text-[11.5px] leading-snug text-muted">
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
            {' · '}cada ficha abre su PDF original en una pestaña nueva
          </p>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

/** Entry to the exercise library: a quiet text button on the start screen, an icon on the desk. */
export const ExercisesButton = ({ variant }: { variant: 'start' | 'bar' }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'bar' ? (
        <IconButton label="Ejercicios" active={open} onClick={() => setOpen(true)}>
          <BookOpen size={18} />
        </IconButton>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-accent outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <BookOpen size={15} className="shrink-0" />
          Ejercicios
        </button>
      )}
      {open && <ExercisesPanel onClose={() => setOpen(false)} />}
    </>
  )
}
