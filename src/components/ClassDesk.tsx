import { Bell, Check, GraduationCap, Send, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { goToStart } from '../state/actions'
import { appStore } from '../state/appStore'
import { checkNews, classStore, markSeen, newsStore, sentBaseline, when, type News } from '../state/classes'
import { createStore, useStore } from '../state/createStore'
import { documentStore } from '../state/documentStore'
import { openPanel, panelStore, SendToTeacher } from './Classes'
import { IconButton } from './ui/IconButton'

/**
 * What a class brings onto the desk: the send button on an exercise of the class, the window to
 * send any sheet, and word of what is new (an exercise put up, a sheet a pupil sent).
 */

const sendStore = createStore<{ open: boolean }>({ open: false })
export const openSend = () => sendStore.set({ open: true })

/** The send window, opened from the bar below or from the save menu. */
export const SendWindow = () => {
  const open = useStore(sendStore, (s) => s.open)
  return open ? <SendToTeacher onClose={() => sendStore.set({ open: false })} /> : null
}

/**
 * On an exercise put up by the teacher of one of the pupil's classes: a clear button to send it,
 * and whether it was sent or has changed since.
 */
export const PupilSendBar = () => {
  const tab = useStore(appStore, (s) => s.tabs.find((t) => t.id === s.activeTab))
  const room = useStore(classStore, (s) => s.pupil.find((r) => r.code === tab?.exercise?.code))
  const shapes = useStore(documentStore, (s) => s.shapes)
  const tabId = tab?.id
  const seenTab = useRef<string | undefined>(undefined)

  // A tab just brought onto the desk starts with its strokes as they are.
  if (tabId && seenTab.current !== tabId) {
    seenTab.current = tabId
    if (!sentBaseline.has(tabId)) sentBaseline.set(tabId, shapes)
  }
  if (!tab?.exercise || !room) return null
  const changed = sentBaseline.get(tab.id) !== shapes
  const sent = tab.sentAt

  return (
    <div className="float animate-pop pointer-events-auto absolute right-4 top-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl py-2 pl-3 pr-2 max-sm:left-2 max-sm:right-auto max-sm:top-2 max-sm:max-w-[calc(100%-7rem)] short:right-auto short:left-1/2 short:top-2 short:-translate-x-1/2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent max-sm:hidden">
        <GraduationCap size={17} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12.5px] font-semibold text-ink">Ejercicio de {room.name}</span>
        <span className={`block truncate text-[11.5px] ${sent && !changed ? 'text-emerald-600 dark:text-emerald-400' : sent ? 'text-amber-600 dark:text-amber-400' : 'text-muted'}`}>
          {!sent ? 'Cuando acabes, envíaselo a tu profe' : changed ? 'Tienes cambios sin enviar' : `Enviado ${when(sent)}`}
        </span>
      </span>
      <button
        type="button"
        onClick={openSend}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 ${
          sent && !changed ? 'bg-accent-soft text-accent' : 'bg-accent text-white'
        }`}
      >
        {sent && !changed ? <Check size={15} /> : <Send size={15} />}
        {sent ? (changed ? 'Enviar cambios' : 'Enviar de nuevo') : 'Enviar al profe'}
      </button>
    </div>
  )
}

/** How often classes are asked what is new while the app is open. */
const CHECK_EVERY_MS = 5 * 60 * 1000

/** Asks the classes kept here what is new, now and every few minutes. */
export const useClassNews = () => {
  const classes = useStore(classStore, (s) => s.teacher.length + s.pupil.length)
  useEffect(() => {
    if (!classes) return
    void checkNews()
    const timer = setInterval(() => void checkNews(), CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [classes])
}

/** The news of one class, said in a line. */
const say = (items: News[]) => {
  const first = items[0]!
  if (first.role === 'pupil')
    return items.length === 1 ? `Tu profe de ${first.className} ha subido «${first.title}»` : `Tu profe de ${first.className} ha subido ${items.length} ejercicios nuevos`
  return items.length === 1 ? `${first.pupil} te ha enviado «${first.title}» en ${first.className}` : `Tienes ${items.length} láminas nuevas de tus alumnos en ${first.className}`
}

/** Word of what is new, one class at a time: on the desk under the bars, on the start screen at the top. */
export const ClassNews = ({ place }: { place: 'desk' | 'start' }) => {
  const news = useStore(newsStore, (s) => s.news)
  const panelOpen = useStore(panelStore, (s) => s.screen !== null)
  if (!news.length || panelOpen) return null
  const code = news[0]!.code
  const items = news.filter((n) => n.code === code)
  const first = items[0]!
  const dismiss = () => markSeen(code, items.map((n) => n.id))
  const look = () => {
    if (place === 'desk') goToStart()
    const pupil = classStore.get().pupil.find((r) => r.code === code)
    if (first.role === 'pupil' && pupil) openPanel({ kind: 'pupil', room: pupil })
    else openPanel({ kind: 'teacher', code })
  }

  return (
    <div
      role="status"
      className={`float animate-pop z-40 flex w-[460px] max-w-[calc(100%-24px)] items-center gap-3 rounded-2xl py-2.5 pl-3 pr-2 ${
        place === 'desk' ? 'absolute left-1/2 top-4 -translate-x-1/2 max-sm:top-16' : 'fixed left-1/2 top-4 -translate-x-1/2'
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent text-white">
        <Bell size={16} />
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">{say(items)}</p>
      <button
        type="button"
        onClick={look}
        className="h-8 shrink-0 rounded-[10px] bg-accent px-3 text-[12.5px] font-medium text-white outline-none transition-opacity hover:opacity-90"
      >
        {first.role === 'pupil' ? 'Ver' : 'Ver láminas'}
      </button>
      <IconButton label="Cerrar" onClick={dismiss}>
        <X size={16} />
      </IconButton>
    </div>
  )
}
