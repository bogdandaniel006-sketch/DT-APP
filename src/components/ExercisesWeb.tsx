import { ArrowLeft, ExternalLink, Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadPdfFromUrl } from '../state/actions'

/** A result of the web search, with what its own server allows (decided by the search service). */
interface WebResult {
  title: string
  url: string
  /** Site the result comes from. */
  source: string
  description: string
  pdf: boolean
  /** May be shown inside this page. */
  embed: boolean
  /** A PDF any page may read: it can go straight onto the desk. */
  desk: boolean
}

type Status = 'idle' | 'searching' | 'done' | 'failed' | 'off'

const SEARCH_URL = '/buscar?q='

const ACTION =
  'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60'

/** The last part of the address, as a file name for the desk. */
const pdfName = (r: WebResult) => {
  const fallback = `${r.title || r.source}.pdf`
  try {
    const last = decodeURIComponent(new URL(r.url).pathname.split('/').pop() ?? '')
    return /\.pdf$/i.test(last) ? last : fallback
  } catch {
    return fallback
  }
}

/** An external page or PDF shown inside the app, with the way back always in sight. */
const Viewer = ({ result, onBack }: { result: WebResult; onBack: () => void }) =>
  createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3 shadow-[0_1px_0_rgba(15,23,42,0.05),0_4px_18px_rgba(15,23,42,0.04)]">
        <button type="button" onClick={onBack} className={`${ACTION} bg-accent-soft text-accent hover:bg-accent/20`}>
          <ArrowLeft size={15} />
          Volver a los resultados
        </button>
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
          <span className="font-medium text-ink">{result.title}</span> · {result.source}
        </p>
        <a href={result.url} target="_blank" rel="noopener noreferrer" className={`${ACTION} text-ink/70 hover:bg-black/[0.04] hover:text-ink`}>
          <span className="hidden sm:inline">Abrir original</span>
          <ExternalLink size={14} />
        </a>
      </header>
      {/* Pages get a sandbox so they cannot take over the tab; the browser's PDF viewer does not run in one. */}
      <iframe
        title={result.title}
        src={result.url}
        referrerPolicy="no-referrer"
        sandbox={result.pdf ? undefined : 'allow-scripts allow-same-origin allow-forms allow-popups'}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>,
    document.body,
  )

interface Props {
  /** What was typed in the library's own search, as a starting point. */
  initialQuery: string
  onBack: () => void
  /** A PDF was put on the desk: the library can close. */
  onOpened: () => void
}

/** Search for exercises outside the library. Results belong to their own sites and open from there. */
export const WebSearch = ({ initialQuery, onBack, onOpened }: Props) => {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<WebResult[]>([])
  const [searched, setSearched] = useState('')
  const [viewing, setViewing] = useState<WebResult | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  /** Results that turned out not to open here after all: they keep only their original link. */
  const [closed, setClosed] = useState<readonly string[]>([])

  // Esc steps back: out of the viewer first, then out of the web search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (viewing) setViewing(null)
      else onBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [viewing, onBack])

  const run = async (e?: FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (q.length < 3 || status === 'searching') return
    setStatus('searching')
    setSearched(q)
    setClosed([])
    try {
      const response = await fetch(SEARCH_URL + encodeURIComponent(q))
      if (response.status === 503) return setStatus('off')
      if (!response.ok || !response.headers.get('content-type')?.includes('json')) return setStatus('failed')
      const data = (await response.json()) as { results?: WebResult[] }
      setResults(data.results ?? [])
      setStatus('done')
    } catch {
      setStatus('failed')
    }
  }

  const openHere = async (r: WebResult) => {
    if (!r.desk) return setViewing(r)
    setOpening(r.url)
    const ok = await loadPdfFromUrl(r.url, pdfName(r))
    setOpening(null)
    if (ok) onOpened()
    else if (r.embed) setViewing(r)
    else setClosed((urls) => [...urls, r.url])
  }

  return (
    <>
      <form onSubmit={(e) => void run(e)} className="flex gap-2 pb-3">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-black/[0.04] px-3 text-muted transition-colors focus-within:bg-accent-soft focus-within:text-accent">
          <Search size={16} className="shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ejercicios de intersección de planos en diédrico…"
            aria-label="Buscar ejercicios en Internet"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <button
          type="submit"
          disabled={query.trim().length < 3 || status === 'searching'}
          className={`${ACTION} h-10 rounded-xl bg-accent px-4 text-white hover:opacity-90`}
        >
          {status === 'searching' ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {status === 'idle' && (
        <p className="px-2.5 py-8 text-center text-[13px] leading-relaxed text-muted">
          Busca fichas y ejercicios de Dibujo Técnico que no estén en la biblioteca.
          <br />
          Los resultados son de páginas externas y se abren desde su sitio original.
        </p>
      )}
      {status === 'off' && (
        <p className="px-2.5 py-8 text-center text-[13px] text-muted">La búsqueda en Internet todavía no está activada en esta web.</p>
      )}
      {status === 'failed' && (
        <p className="px-2.5 py-8 text-center text-[13px] text-red-600">No se ha podido buscar ahora. Inténtalo de nuevo en un momento.</p>
      )}
      {status === 'done' && results.length === 0 && (
        <p className="px-2.5 py-8 text-center text-[13px] text-muted">No se han encontrado resultados para «{searched}».</p>
      )}

      {status === 'done' && results.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {results.map((r) => {
            const here = (r.desk || r.embed) && !closed.includes(r.url)
            return (
              <li key={r.url} className="flex flex-col rounded-2xl bg-black/[0.03] p-3.5">
                <p className="text-[13.5px] font-semibold leading-snug text-ink">{r.title || r.source}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="truncate">{r.source}</span>
                  <span className="shrink-0 rounded-[5px] bg-white px-1.5 py-px text-[10.5px] font-semibold text-accent">
                    {r.pdf ? 'PDF' : 'WEB'}
                  </span>
                </p>
                {r.description && <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-muted">{r.description}</p>}
                <div className="mt-auto flex flex-col gap-1.5 pt-3 sm:flex-row">
                  {here && (
                    <button
                      type="button"
                      onClick={() => void openHere(r)}
                      disabled={opening !== null}
                      className={`${ACTION} bg-accent text-white hover:opacity-90`}
                    >
                      {opening === r.url ? 'Abriendo…' : 'Abrir aquí'}
                    </button>
                  )}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ACTION} bg-white text-ink/80 shadow-[0_1px_4px_rgba(15,23,42,0.08)] hover:text-ink`}
                  >
                    Abrir original
                    <ExternalLink size={13} />
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {viewing && <Viewer result={viewing} onBack={() => setViewing(null)} />}
    </>
  )
}
