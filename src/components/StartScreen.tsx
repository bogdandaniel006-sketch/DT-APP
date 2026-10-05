import { ArrowLeft, FolderOpen } from 'lucide-react'
import { resumeWorkspace } from '../state/actions'
import { appStore } from '../state/appStore'
import { useStore } from '../state/createStore'
import { Credit } from './Credit'
import { ExercisesButton } from './Exercises'
import { openPdfDialog } from './TopBar'

/** A quiet construction drawing: a triangle, its circumcircle and a few helper arcs. */
const Illustration = () => (
  <svg width="180" height="132" viewBox="0 0 180 132" fill="none" aria-hidden className="mb-9">
    <circle cx="90" cy="72" r="52" stroke="#2563EB" strokeOpacity="0.22" strokeDasharray="3 4" />
    <path d="M38 98 142 98 90 20Z" stroke="#1F2329" strokeOpacity="0.7" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M90 20 90 98" stroke="#2563EB" strokeOpacity="0.5" strokeDasharray="2 3" />
    <path d="M84 98h6v-6" stroke="#2563EB" strokeWidth="1.2" />
    <path d="M58 84a40 40 0 0 1 64 0" stroke="#2563EB" strokeOpacity="0.55" />
    <circle cx="38" cy="98" r="2.6" fill="white" stroke="#2563EB" strokeWidth="1.4" />
    <circle cx="142" cy="98" r="2.6" fill="white" stroke="#2563EB" strokeWidth="1.4" />
    <circle cx="90" cy="20" r="2.6" fill="white" stroke="#2563EB" strokeWidth="1.4" />
    <circle cx="90" cy="72" r="1.8" fill="#2563EB" />
  </svg>
)

export const StartScreen = () => {
  const phase = useStore(appStore, (s) => s.phase)
  const error = useStore(appStore, (s) => s.error)
  const fileName = useStore(appStore, (s) => s.fileName)
  const loading = phase === 'loading'

  return (
    <main className="desk flex h-full flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center text-center animate-pop">
        <Illustration />
        <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-ink">Tu mesa de dibujo técnico</h1>
        <Credit className="mt-3 text-[24px] tracking-[-0.02em]" />
        <button
          type="button"
          onClick={() => void openPdfDialog()}
          disabled={loading}
          className="mt-8 flex h-12 items-center gap-2.5 rounded-2xl bg-white px-6 text-[15px] font-medium text-ink shadow-[var(--shadow-float)] outline-none transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-float-hover)] focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60"
        >
          <FolderOpen size={18} className="text-accent" />
          {loading ? 'Abriendo…' : 'Abrir PDF'}
        </button>
        {fileName && !loading && (
          <button
            type="button"
            onClick={() => void resumeWorkspace()}
            className="mt-3 flex h-9 max-w-[80vw] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-accent outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ArrowLeft size={15} className="shrink-0" />
            <span className="truncate">Volver a {fileName}</span>
          </button>
        )}
        <ExercisesButton variant="start" />
        <p className="mt-4 text-[13px] text-muted">Abre un ejercicio en PDF o un proyecto guardado (.lamina) y empieza a construir.</p>
        {error && <p className="mt-4 text-[13px] text-red-600">{error}</p>}
      </div>
    </main>
  )
}
