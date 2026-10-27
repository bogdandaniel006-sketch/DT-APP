import { ArrowLeft, BookOpen, Check, Copy, FileUp, GraduationCap, RotateCw, Send, Trash2, UserRound, Users, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { imagePdf } from '../pdf/make'
import { getSession } from '../pdf/session'
import { activateTab, goToStart, loadPdf, noteTabSent } from '../state/actions'
import { appStore } from '../state/appStore'
import {
  SENT_TAG,
  addLibraryExercise,
  deleteMine,
  markSeen,
  markSentNow,
  newsStore,
  mySent,
  mySheet,
  seenIn,
  type MySheet,
  classStore,
  cleanCode,
  createClass,
  deleteClass,
  deleteExercise,
  deleteSent,
  exercisePdf,
  forgetClass,
  isTeacherCode,
  joinClass,
  pupilView,
  sendSheet,
  sentSheet,
  showCode,
  teacherView,
  when,
  uploadExercise,
  type PupilClass,
  type PupilView,
  type SentSheet,
  type TeacherView,
} from '../state/classes'
import { createStore, useStore } from '../state/createStore'
import { documentStore } from '../state/documentStore'
import { touchStore } from '../utils/device'
import { baseName } from '../utils/download'
import { pickPdf } from '../utils/filePicker'
import { ExercisesPanel } from './Exercises'
import { IconButton } from './ui/IconButton'

type Screen =
  | { kind: 'home' }
  | { kind: 'create' }
  | { kind: 'teacher-login' }
  | { kind: 'join' }
  | { kind: 'teacher'; code: string; fresh?: boolean }
  | { kind: 'pupil'; room: PupilClass }

/** The classes window: closed, or open on a screen. */
export const panelStore = createStore<{ screen: Screen | null }>({ screen: null })
export const openPanel = (screen: Screen = { kind: 'home' }) => panelStore.set({ screen })
const closePanel = () => panelStore.set({ screen: null })

const PRIMARY =
  'flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[13.5px] font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'
const SOFT =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[12.5px] font-medium text-accent outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'
const QUIET =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-muted outline-none transition-colors hover:bg-black/[0.04] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50'
const DANGER =
  'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-red-600 outline-none transition-colors hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50'
const FIELD =
  'h-10 w-full rounded-xl bg-black/[0.04] px-3 text-[14px] text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent/40'

const message = (err: unknown) => (err instanceof Error && err.message ? err.message : 'No se ha podido hacer. Vuelve a probar.')

const Problem = ({ children }: { children: ReactNode }) => (children ? <p className="text-[12.5px] leading-snug text-red-600">{children}</p> : null)

const Label = ({ children }: { children: ReactNode }) => <span className="mb-1 block text-[12px] font-medium text-muted">{children}</span>

const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="mb-1.5 mt-5 flex items-center justify-between gap-2">
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-faint">{children}</h3>
    {action}
  </div>
)

/** A code with a button to copy it. */
const CodeBox = ({ label, code, note }: { label: string; code: string; note: string }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(showCode(code)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex-1 rounded-2xl bg-black/[0.03] p-3">
      <p className="text-[11.5px] font-medium text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className={`min-w-0 flex-1 select-all whitespace-nowrap font-mono font-semibold text-ink ${code.length > 8 ? 'text-[13.5px] tracking-wide' : 'text-[17px] tracking-wider'}`}>{showCode(code)}</code>
        <button type="button" onClick={copy} className={SOFT} aria-label={`Copiar ${label.toLowerCase()}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-muted">{note}</p>
    </div>
  )
}

/** First screen: the classes kept in this browser and the three ways in. */
const Home = ({ go }: { go: (s: Screen) => void }) => {
  const teacher = useStore(classStore, (s) => s.teacher)
  const pupil = useStore(classStore, (s) => s.pupil)
  const choice = (icon: ReactNode, title: string, text: string, to: Screen) => (
    <button
      type="button"
      onClick={() => go(to)}
      className="flex items-start gap-3 rounded-2xl p-3 text-left outline-none ring-1 ring-black/[0.07] transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <span>
        <span className="block text-[14px] font-semibold text-ink">{title}</span>
        <span className="block text-[12.5px] leading-snug text-muted">{text}</span>
      </span>
    </button>
  )
  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted">
        Sin cuentas: el profesor crea una clase, sube las láminas y reparte un código. Los alumnos las hacen desde casa, aquí mismo, y si
        quieren se las envían para que las vea.
      </p>
      {(teacher.length > 0 || pupil.length > 0) && (
        <>
          <SectionTitle>Mis clases en este navegador</SectionTitle>
          <div className="flex flex-col gap-1">
            {teacher.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => go({ kind: 'teacher', code: c.code })}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-ink outline-none transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft"
              >
                <GraduationCap size={16} className="text-accent" />
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <span className="rounded-full bg-accent-soft px-2 py-px text-[11px] font-medium text-accent">Profesor</span>
              </button>
            ))}
            {pupil.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => go({ kind: 'pupil', room: c })}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-ink outline-none transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft"
              >
                <UserRound size={16} className="text-accent" />
                <span className="flex-1 truncate font-medium">{c.name}</span>
                <span className="text-[11.5px] text-muted">{c.pupil}</span>
                <span className="rounded-full bg-black/[0.05] px-2 py-px text-[11px] font-medium text-muted">Alumno</span>
              </button>
            ))}
          </div>
        </>
      )}
      <SectionTitle>Empezar</SectionTitle>
      <div className="grid gap-2">
        {choice(<GraduationCap size={18} />, 'Crear una clase', 'Soy profesor: quiero mandar láminas a mis alumnos.', { kind: 'create' })}
        {choice(<Users size={18} />, 'Unirme a una clase', 'Soy alumno: mi profesor me ha dado un código.', { kind: 'join' })}
        {choice(<GraduationCap size={18} />, 'Entrar en mi clase', 'Soy profesor y tengo mi código de profesor (en otro ordenador, por ejemplo).', {
          kind: 'teacher-login',
        })}
      </div>
    </>
  )
}

const Create = ({ go }: { go: (s: Screen) => void }) => {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const room = await createClass(name.trim())
      go({ kind: 'teacher', code: room.code, fresh: true })
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label>
        <Label>Nombre de la clase</Label>
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Por ejemplo: 1º Bachillerato B · Dibujo Técnico" autoFocus />
      </label>
      <p className="text-[12.5px] leading-snug text-muted">
        Te daremos dos códigos: uno para ti, con el que entras a la clase desde cualquier ordenador, y otro para tus alumnos.
      </p>
      <Problem>{error}</Problem>
      <button type="submit" className={PRIMARY} disabled={busy || !name.trim()}>
        {busy ? 'Creando…' : 'Crear la clase'}
      </button>
    </form>
  )
}

const TeacherLogin = ({ go }: { go: (s: Screen) => void }) => {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = cleanCode(code)
    if (!isTeacherCode(clean)) return setError('El código de profesor empieza por P y tiene 16 letras y números. El de alumnos no sirve aquí.')
    setBusy(true)
    setError('')
    try {
      await teacherView(clean)
      go({ kind: 'teacher', code: clean })
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label>
        <Label>Código de profesor</Label>
        <input className={`${FIELD} font-mono uppercase tracking-wider`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="PXXX-XXXX-XXXX-XXXX" autoFocus autoComplete="off" />
      </label>
      <Problem>{error}</Problem>
      <button type="submit" className={PRIMARY} disabled={busy || !code.trim()}>
        {busy ? 'Entrando…' : 'Entrar en la clase'}
      </button>
    </form>
  )
}

const Join = ({ go }: { go: (s: Screen) => void }) => {
  const [code, setCode] = useState('')
  const [first, setFirst] = useState('')
  const [initial, setInitial] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = code.trim() && first.trim() && initial.trim()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = cleanCode(code)
    if (isTeacherCode(clean)) return setError('Ese es un código de profesor. Pide a tu profe el código para los alumnos.')
    setBusy(true)
    setError('')
    try {
      const pupil = `${first.trim().replace(/\s+/g, ' ')} ${initial.trim().toUpperCase()}.`
      go({ kind: 'pupil', room: await joinClass(clean, pupil) })
    } catch (err) {
      setError(message(err))
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label>
        <Label>Código de la clase</Label>
        <input className={`${FIELD} font-mono uppercase tracking-wider`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXX-XXX" autoFocus autoComplete="off" />
      </label>
      <div className="flex gap-2">
        <label className="flex-1">
          <Label>Tu nombre</Label>
          <input className={FIELD} value={first} onChange={(e) => setFirst(e.target.value)} maxLength={40} placeholder="Ana" autoComplete="given-name" />
        </label>
        <label className="w-32">
          <Label>Inicial del apellido</Label>
          <input className={`${FIELD} text-center uppercase`} value={initial} onChange={(e) => setInitial(e.target.value.replace(/[^\p{L}]/gu, '').slice(-1))} maxLength={1} placeholder="G" />
        </label>
      </div>
      <p className="text-[12.5px] leading-snug text-muted">Solo tu nombre y la inicial del apellido, para que tu profe sepa de quién es cada lámina.</p>
      <Problem>{error}</Problem>
      <button type="submit" className={PRIMARY} disabled={busy || !ready}>
        {busy ? 'Entrando…' : 'Unirme a la clase'}
      </button>
    </form>
  )
}

const MB = 1024 * 1024
const megabytes = (bytes: number) => `${bytes >= 10 * MB ? Math.round(bytes / MB) : (bytes / MB).toFixed(1).replace('.', ',')} MB`

/** The teacher's class: the codes, the exercises put up and the sheets pupils sent. */
const Teacher = ({ code, fresh, go, close }: { code: string; fresh?: boolean; go: (s: Screen) => void; close: () => void }) => {
  const [view, setView] = useState<TeacherView | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set())

  const reload = async () => {
    setError('')
    try {
      const next = await teacherView(code)
      setView(next)
      const seen = seenIn(code)
      if (seen) setArrived((was) => new Set([...was, ...next.entregas.filter((s) => !seen.has(s.id)).map((s) => s.id)]))
      markSeen(code, next.entregas.map((s) => s.id))
    } catch (err) {
      setError(message(err))
    }
  }
  useEffect(() => {
    void reload()
  }, [code])

  const run = async (what: string, job: () => Promise<unknown>) => {
    setBusy(what)
    setError('')
    try {
      await job()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(null)
    }
  }

  const upload = () =>
    run('subir', async () => {
      const file = await pickPdf()
      if (!file) return
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const isImage = file.type.startsWith('image/')
      if (!isPdf && !isImage) throw new Error('Sube un PDF o una imagen.')
      const bytes = isPdf ? new Uint8Array(await file.arrayBuffer()) : await imagePdf(file)
      const title = file.name.replace(/\.[a-z0-9]+$/i, '') || 'Ejercicio'
      await uploadExercise(code, title, `${title}.pdf`, bytes)
      await reload()
    })

  const [picking, setPicking] = useState(false)
  const pick = async (address: string, name: string) => {
    try {
      await addLibraryExercise(code, address, name)
      await reload()
      return true
    } catch (err) {
      setError(message(err))
      return false
    }
  }

  const openExercise = (id: string, title: string) =>
    run('abrir' + id, async () => {
      await loadPdf(await exercisePdf(code, id), `${title}.pdf`, { kind: 'pdf' })
      close()
    })

  const openSent = (sheet: SentSheet) =>
    run('abrir' + sheet.id, async () => {
      const project = await sentSheet(code, sheet.id)
      await loadPdf(project.bytes, `${sheet.alumno} · ${sheet.titulo}.pdf`, { drawing: project, tag: SENT_TAG + sheet.id })
      close()
    })

  if (!view)
    return error ? (
      <div className="flex flex-col gap-3">
        <Problem>{error}</Problem>
        <div className="flex gap-2">
          <button type="button" className={SOFT} onClick={() => void reload()}>
            Volver a probar
          </button>
          {/* A class deleted (or swept away after months unused) is only taken off this browser. */}
          <button
            type="button"
            className={QUIET}
            onClick={() => {
              forgetClass(code)
              go({ kind: 'home' })
            }}
          >
            Quitar de este navegador
          </button>
        </div>
      </div>
    ) : (
      <p className="text-[13px] text-muted">Abriendo la clase…</p>
    )

  // The same name sent from two devices: perhaps two pupils with the same name, perhaps one passing for another.
  const keysByName = new Map<string, Set<string>>()
  for (const s of view.entregas) keysByName.set(s.alumno, (keysByName.get(s.alumno) ?? new Set()).add(s.clave))
  const sentOn = (id: string) => view.entregas.filter((s) => s.ejercicio === id).length
  const pupils = new Set(view.entregas.map((s) => s.clave)).size

  return (
    <>
      {fresh && (
        <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] leading-snug text-amber-700 dark:text-amber-300">
          Apunta tu <b>código de profesor</b> en un sitio seguro: con él entras a esta clase desde cualquier ordenador. No se lo des a los alumnos.
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <CodeBox label="Código para los alumnos" code={view.alumnos} note="Dáselo a tus alumnos para que se unan." />
        <CodeBox label="Tu código de profesor" code={view.profesor} note="Solo para ti: abre la clase en otro navegador." />
      </div>

      <SectionTitle
        action={
          <div className="flex gap-1.5">
            <button type="button" className={SOFT} onClick={() => setPicking(true)} disabled={busy !== null}>
              <BookOpen size={14} />
              De la biblioteca
            </button>
            <button type="button" className={SOFT} onClick={() => void upload()} disabled={busy !== null}>
              <FileUp size={14} />
              {busy === 'subir' ? 'Subiendo…' : 'Subir archivo'}
            </button>
          </div>
        }
      >
        Ejercicios · {view.ejercicios.length}
      </SectionTitle>
      {view.ejercicios.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          Elige fichas de la biblioteca de ejercicios o sube un PDF o una imagen tuyos: tus alumnos los verán en la clase y los podrán hacer aquí.
        </p>
      ) : (
        <ul className="flex flex-col">
          {view.ejercicios.map((x) => (
            <li key={x.id} className="flex items-center gap-2 border-b border-black/[0.05] py-1.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{x.titulo}</span>
                <span className="text-[11.5px] text-muted">
                  {x.origen && <span className="mr-1 rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent">Biblioteca</span>}
                  {when(x.fecha)} · {sentOn(x.id) === 1 ? '1 lámina enviada' : `${sentOn(x.id)} láminas enviadas`}
                </span>
              </span>
              <button type="button" className={QUIET} onClick={() => void openExercise(x.id, x.titulo)} disabled={busy !== null}>
                {busy === 'abrir' + x.id ? 'Abriendo…' : 'Ver'}
              </button>
              <IconButton
                label="Borrar el ejercicio"
                onClick={() => {
                  const n = sentOn(x.id)
                  const also = n ? ` También se borrarán ${n === 1 ? 'la lámina que te han enviado' : `las ${n} láminas que te han enviado`} sobre él.` : ''
                  if (window.confirm(`¿Borrar «${x.titulo}» de la clase?${also}`)) void run('borrar' + x.id, async () => {
                    await deleteExercise(code, x.id)
                    await reload()
                  })
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle
        action={
          <button type="button" className={QUIET} onClick={() => void run('recargar', reload)} disabled={busy !== null} aria-label="Actualizar">
            <RotateCw size={14} className={busy === 'recargar' ? 'animate-spin' : ''} />
            Actualizar
          </button>
        }
      >
        Láminas enviadas · {view.entregas.length}
        {pupils > 0 && ` de ${pupils} ${pupils === 1 ? 'alumno' : 'alumnos'}`}
      </SectionTitle>
      {view.entregas.length === 0 ? (
        <p className="text-[12.5px] text-muted">Aquí aparecerán las láminas que te envíen tus alumnos.</p>
      ) : (
        <ul className="flex flex-col">
          {view.entregas.map((s) => (
            <li key={s.id} className="flex items-center gap-2 border-b border-black/[0.05] py-1.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13.5px] text-ink">
                  <span className="truncate">
                    <b className="font-semibold">{s.alumno}</b> · {s.titulo}
                  </span>
                  {arrived.has(s.id) && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-white">Nueva</span>}
                </span>
                <span className="text-[11.5px] text-muted">
                  {when(s.fecha)}
                  {(keysByName.get(s.alumno)?.size ?? 0) > 1 && (
                    <span className="ml-1.5 text-amber-600" title="Hay láminas con este nombre enviadas desde dispositivos distintos">
                      · mismo nombre desde otro dispositivo
                    </span>
                  )}
                </span>
              </span>
              <button type="button" className={SOFT} onClick={() => void openSent(s)} disabled={busy !== null}>
                {busy === 'abrir' + s.id ? 'Abriendo…' : 'Abrir'}
              </button>
              <IconButton
                label="Borrar la lámina"
                onClick={() => {
                  if (window.confirm(`¿Borrar la lámina «${s.titulo}» de ${s.alumno}?`)) void run('borrar' + s.id, async () => {
                    await deleteSent(code, s.id)
                    await reload()
                  })
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <Problem>{error}</Problem>
      </div>
      {picking && <ExercisesPanel onClose={() => setPicking(false)} onPick={pick} />}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
        <p className="flex-1 text-[11.5px] leading-snug text-faint">
          {megabytes(view.bytes)} de {megabytes(view.espacio)} usados. Una clase que nadie abre en 6 meses se borra sola.
        </p>
        <button
          type="button"
          className={QUIET}
          onClick={() => {
            forgetClass(code)
            go({ kind: 'home' })
          }}
        >
          Quitar de este navegador
        </button>
        <button
          type="button"
          className={DANGER}
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm(`¿Eliminar la clase «${view.nombre}» por completo? Se borrarán sus ejercicios y todas las láminas enviadas, para todos. No se puede deshacer.`)) return
            void run('eliminar', async () => {
              await deleteClass(code)
              go({ kind: 'home' })
            })
          }}
        >
          <Trash2 size={14} />
          Eliminar la clase
        </button>
      </div>
    </>
  )
}

/** Opens one of the pupil's own sent sheets to look at it or change it: their own copy if it is open here. */
const openMine = async (room: PupilClass, sheet: MySheet) => {
  const { tabs } = appStore.get()
  const open = sheet.ejercicio ? tabs.find((t) => t.exercise?.id === sheet.ejercicio && t.exercise.code === room.code) : undefined
  if (open) return activateTab(open.id)
  const project = await mySheet(room, sheet.id)
  await loadPdf(project.bytes, `${sheet.titulo}.pdf`, {
    drawing: project,
    ...(sheet.ejercicio
      ? { exercise: { code: room.code, id: sheet.ejercicio, title: sheet.titulo, bytes: project.bytes.length } }
      : { tag: 'enviada-' + sheet.id }),
  })
}

/** A pupil's class: the exercises to do, whether each was sent, and everything sent. */
const Pupil = ({ room, go, close }: { room: PupilClass; go: (s: Screen) => void; close: () => void }) => {
  const [view, setView] = useState<PupilView | null>(null)
  const [mine, setMine] = useState<MySheet[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  const reload = async () => {
    try {
      const [v, m] = await Promise.all([pupilView(room.code), mySent(room)])
      setView(v)
      setMine(m)
      // What was new is marked as such once, then counts as seen.
      const seen = seenIn(room.code)
      if (seen) setFresh((was) => new Set([...was, ...v.ejercicios.filter((x) => !seen.has(x.id)).map((x) => x.id)]))
      markSeen(room.code, v.ejercicios.map((x) => x.id))
    } catch (err) {
      setError(message(err))
    }
  }
  useEffect(() => {
    void reload()
  }, [room.code])

  const run = async (what: string, job: () => Promise<unknown>, closing = true) => {
    setBusy(what)
    setError('')
    try {
      await job()
      if (closing) close()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(null)
    }
  }

  const open = (id: string, title: string) =>
    run('abrir' + id, async () => {
      // The pupil's own copy, if it is open here, is the one with their work.
      const here = appStore.get().tabs.find((t) => t.exercise?.id === id && t.exercise.code === room.code)
      if (here) return activateTab(here.id)
      const bytes = await exercisePdf(room.code, id)
      await loadPdf(bytes, `${title}.pdf`, { kind: 'pdf', exercise: { code: room.code, id, title, bytes: bytes.length } })
    })

  const sentOn = (id: string) => mine.find((m) => m.ejercicio === id)

  return (
    <>
      <p className="text-[13px] text-muted">
        Estás como <b className="font-semibold text-ink">{room.pupil}</b>
      </p>
      <SectionTitle>Ejercicios de tu profe</SectionTitle>
      {!view ? (
        error ? null : <p className="text-[13px] text-muted">Abriendo la clase…</p>
      ) : view.ejercicios.length === 0 ? (
        <p className="text-[12.5px] text-muted">Tu profe todavía no ha subido ningún ejercicio.</p>
      ) : (
        <ul className="flex flex-col">
          {view.ejercicios.map((x) => {
            const sent = sentOn(x.id)
            return (
              <li key={x.id} className="flex items-center gap-2 border-b border-black/[0.05] py-1.5 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                    <span className="truncate">{x.titulo}</span>
                    {fresh.has(x.id) && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-white">Nuevo</span>}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {sent ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        <Check size={12} className="-mt-px mr-0.5 inline" />
                        Enviado {when(sent.fecha)}
                      </span>
                    ) : (
                      <>Subido {when(x.fecha)} · sin enviar</>
                    )}
                  </span>
                </span>
                <button type="button" className={SOFT} onClick={() => void open(x.id, x.titulo)} disabled={busy !== null}>
                  {busy === 'abrir' + x.id ? 'Abriendo…' : sent ? 'Abrir' : 'Hacerlo'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <SectionTitle>Lo que has enviado · {mine.length}</SectionTitle>
      {mine.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          Todavía no has enviado nada. Cuando abras un ejercicio de tu profe, arriba a la derecha tendrás el botón <b>Enviar al profe</b>. Cualquier
          otra lámina se envía desde el botón de guardar (la flecha hacia abajo).
        </p>
      ) : (
        <ul className="flex flex-col">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center gap-2 border-b border-black/[0.05] py-1.5 last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{m.titulo}</span>
                <span className="text-[11.5px] text-muted">
                  Enviada {when(m.fecha)}
                  {m.ejercicio ? ' · ejercicio de la clase' : ''}
                </span>
              </span>
              <button type="button" className={SOFT} onClick={() => void run('mia' + m.id, () => openMine(room, m))} disabled={busy !== null}>
                {busy === 'mia' + m.id ? 'Abriendo…' : 'Abrir y cambiar'}
              </button>
              <IconButton
                label="Borrar lo enviado"
                onClick={() => {
                  if (!window.confirm(`¿Borrar «${m.titulo}» de lo que has enviado? Tu profe ya no la verá.`)) return
                  void run(
                    'borrar' + m.id,
                    async () => {
                      await deleteMine(room, m.id)
                      await reload()
                    },
                    false,
                  )
                }}
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {mine.length > 0 && (
        <p className="mt-2 text-[11.5px] leading-snug text-muted">
          Para cambiar una lámina, ábrela, haz los cambios y vuelve a enviarla: tu profe verá la nueva en lugar de la anterior.
        </p>
      )}
      <Problem>{error}</Problem>
      <div className="mt-5 flex justify-end border-t border-black/[0.06] pt-3">
        <button
          type="button"
          className={QUIET}
          onClick={() => {
            if (!window.confirm(`¿Salir de la clase «${room.name}» en este navegador? Para volver necesitarás el código de la clase.`)) return
            forgetClass(room.code)
            go({ kind: 'home' })
          }}
        >
          Salir de la clase
        </button>
      </div>
    </>
  )
}

const TITLES: Record<Screen['kind'], string> = {
  home: 'Clases',
  create: 'Crear una clase',
  'teacher-login': 'Entrar en mi clase',
  join: 'Unirme a una clase',
  teacher: 'Clase',
  pupil: 'Clase',
}

/** Classes: opened from the start screen only. */
export const ClassesPanel = () => {
  const screen = useStore(panelStore, (s) => s.screen)
  const teacher = useStore(classStore, (s) => s.teacher)
  const pupil = useStore(classStore, (s) => s.pupil)
  const open = screen !== null
  const setScreen = (next: Screen) => openPanel(next)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key !== 'Escape' || document.querySelectorAll('[aria-modal=true]').length > 1) return
      e.preventDefault()
      closePanel()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!screen) return null
  const name =
    screen.kind === 'teacher' ? (teacher.find((c) => c.code === screen.code)?.name ?? 'Clase') : screen.kind === 'pupil' ? (pupil.find((c) => c.code === screen.room.code)?.name ?? screen.room.name) : TITLES[screen.kind]

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/20 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && closePanel()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Clases"
        className="animate-pop flex max-h-full w-full max-w-xl flex-col rounded-3xl bg-white shadow-[0_10px_36px_rgba(15,23,42,0.14)]"
      >
        <header className="flex items-center gap-2 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
          {screen.kind !== 'home' && (
            <IconButton label="Volver" onClick={() => setScreen({ kind: 'home' })}>
              <ArrowLeft size={18} />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-faint">
              {screen.kind === 'teacher' ? 'Tu clase · profesor' : screen.kind === 'pupil' ? 'Tu clase · alumno' : 'Para profesores y alumnos'}
            </p>
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">{name}</h2>
          </div>
          <IconButton label="Cerrar" onClick={closePanel}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 overflow-y-auto px-4 pb-5 sm:px-6">
          {screen.kind === 'home' && <Home go={setScreen} />}
          {screen.kind === 'create' && <Create go={setScreen} />}
          {screen.kind === 'teacher-login' && <TeacherLogin go={setScreen} />}
          {screen.kind === 'join' && <Join go={setScreen} />}
          {screen.kind === 'teacher' && <Teacher key={screen.code} code={screen.code} fresh={screen.fresh} go={setScreen} close={closePanel} />}
          {screen.kind === 'pupil' && <Pupil key={screen.room.code} room={screen.room} go={setScreen} close={closePanel} />}
        </div>
      </section>
    </div>,
    document.body,
  )
}

/** The classes on the start screen, large, beside the desk: the way in for teachers and pupils. */
export const ClassesCard = () => {
  const teacher = useStore(classStore, (s) => s.teacher)
  const pupil = useStore(classStore, (s) => s.pupil)
  const news = useStore(newsStore, (s) => s.news)
  const newIn = (code: string) => news.filter((n) => n.code === code).length
  const badge = (code: string) =>
    newIn(code) > 0 && (
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white" title="Novedades">
        {newIn(code)}
      </span>
    )
  const mine = teacher.length + pupil.length > 0
  return (
    <aside aria-label="Clases" className="float animate-pop w-full max-w-[380px] rounded-3xl p-6 text-left">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
          <GraduationCap size={24} />
        </span>
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Clases</h2>
          <p className="text-[12.5px] text-muted">Para profes y alumnos · sin cuentas</p>
        </div>
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-ink/80">
        El profe sube las láminas y reparte un código. Los alumnos las hacen desde casa, aquí mismo, y si quieren se las envían para que las vea.
      </p>
      {mine && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-faint">Tus clases</p>
          <div className="flex flex-col gap-1">
            {teacher.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => openPanel({ kind: 'teacher', code: c.code })}
                className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2.5 text-left text-[13.5px] text-ink outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <GraduationCap size={16} className="shrink-0 text-accent" />
                <span className="flex-1 truncate font-medium">{c.name}</span>
                {badge(c.code)}
                <span className="text-[11px] font-medium text-accent">Profesor</span>
              </button>
            ))}
            {pupil.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => openPanel({ kind: 'pupil', room: c })}
                className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2.5 text-left text-[13.5px] text-ink outline-none transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                <UserRound size={16} className="shrink-0 text-accent" />
                <span className="flex-1 truncate font-medium">{c.name}</span>
                {badge(c.code)}
                <span className="text-[11px] text-muted">{c.pupil}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" onClick={() => openPanel({ kind: 'create' })} className={`${PRIMARY} h-11 text-[14px]`}>
          <GraduationCap size={17} />
          Crear una clase · soy profe
        </button>
        <button
          type="button"
          onClick={() => openPanel({ kind: 'join' })}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft px-4 text-[14px] font-medium text-accent outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <Users size={17} />
          Unirme con un código · soy alumno
        </button>
        <button
          type="button"
          onClick={() => openPanel({ kind: 'teacher-login' })}
          className="mt-1 self-center text-[12.5px] font-medium text-muted underline-offset-2 outline-none hover:text-accent hover:underline focus-visible:underline"
        >
          Ya tengo mi código de profesor
        </button>
      </div>
    </aside>
  )
}

const TIP_KEY = 'lamina:aviso-clases'
const TIP_EVERY_DAYS = 6
const TIP_AFTER_MS = 40 * 1000

/**
 * On the desk, now and then (every few days, after a while drawing): a word that classes exist,
 * for teachers. Not to those already in one, and never over the touch offer.
 */
export const ClassesTip = () => {
  const [shown, setShown] = useState(false)
  const inClass = useStore(classStore, (s) => s.teacher.length + s.pupil.length > 0)
  const touchOffered = useStore(touchStore, (s) => s.offered)

  useEffect(() => {
    if (inClass) return
    let last = 0
    try {
      last = Number(localStorage.getItem(TIP_KEY) ?? 0)
    } catch {
      return
    }
    if (Date.now() - last < TIP_EVERY_DAYS * 86400000) return
    const timer = setTimeout(() => {
      setShown(true)
      try {
        localStorage.setItem(TIP_KEY, String(Date.now()))
      } catch {
        /* shown this once */
      }
    }, TIP_AFTER_MS)
    return () => clearTimeout(timer)
  }, [inClass])

  if (!shown || inClass || touchOffered) return null
  return (
    <div
      role="status"
      className="float animate-pop absolute left-1/2 top-4 z-40 flex w-[440px] max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-3 rounded-2xl py-2.5 pl-3 pr-2"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <GraduationCap size={17} />
      </span>
      <p className="flex-1 text-[12.5px] leading-snug text-ink">
        <b className="font-semibold">¿Eres profesor?</b> Ya puedes crear una clase y mandar láminas a tus alumnos para hacerlas desde casa.
      </p>
      <button
        type="button"
        onClick={() => {
          setShown(false)
          goToStart()
          openPanel()
        }}
        className="h-8 shrink-0 rounded-[10px] bg-accent px-3 text-[12.5px] font-medium text-white outline-none transition-opacity hover:opacity-90"
      >
        Ver clases
      </button>
      <IconButton label="Cerrar" onClick={() => setShown(false)}>
        <X size={16} />
      </IconButton>
    </div>
  )
}

/** Sending the sheet on the desk to the teacher of a class: only when the pupil asks. */
export const SendToTeacher = ({ onClose }: { onClose: () => void }) => {
  const rooms = useStore(classStore, (s) => s.pupil)
  const tab = useStore(appStore, (s) => s.tabs.find((t) => t.id === s.activeTab))
  const fileName = useStore(appStore, (s) => s.fileName)
  const [code, setCode] = useState(() => (tab?.exercise && rooms.some((r) => r.code === tab.exercise?.code) ? tab.exercise.code : (rooms[0]?.code ?? '')))
  const [title, setTitle] = useState(() => tab?.exercise?.title ?? baseName(fileName))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const room = rooms.find((r) => r.code === code)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const session = getSession()
    if (!room || !session) return
    setBusy(true)
    setError('')
    try {
      const sheet = { name: session.name, bytes: session.bytes, shapes: [...documentStore.get().shapes], page: appStore.get().page }
      const { replaced } = await sendSheet(room, title.trim() || 'Lámina', sheet, tab?.exercise)
      noteTabSent()
      markSentNow()
      setDone(replaced ? 'Enviada de nuevo: tu profe verá esta versión en lugar de la anterior.' : 'Enviada. Tu profe ya puede verla.')
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/20 p-3 backdrop-blur-[2px] sm:items-center" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Enviar al profesor"
        onSubmit={(e) => void send(e)}
        className="animate-pop flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.14)]"
      >
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em] text-ink">Enviar al profesor</h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {done ? (
          <>
            <p className="flex items-start gap-2 text-[13.5px] leading-snug text-ink">
              <Check size={17} className="mt-px shrink-0 text-accent" />
              {done}
            </p>
            <button type="button" className={PRIMARY} onClick={onClose}>
              Hecho
            </button>
          </>
        ) : (
          <>
            {rooms.length > 1 && (
              <label>
                <Label>Clase</Label>
                <select className={FIELD} value={code} onChange={(e) => setCode(e.target.value)}>
                  {rooms.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <Label>Nombre de la lámina</Label>
              <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
            </label>
            <p className="text-[12.5px] leading-snug text-muted">
              {room ? (
                <>
                  Tu profe de <b className="text-ink">{room.name}</b> verá esta lámina con tus trazos y tu nombre (<b className="text-ink">{room.pupil}</b>). Si la vuelves a enviar, se cambia por la nueva.
                </>
              ) : (
                'Elige una clase.'
              )}
            </p>
            <Problem>{error}</Problem>
            <button type="submit" className={PRIMARY} disabled={busy || !room}>
              <Send size={15} />
              {busy ? 'Enviando…' : 'Enviar'}
            </button>
          </>
        )}
      </form>
    </div>,
    document.body,
  )
}
