import { decodeProject, encodeProject } from '../utils/project'
import { newId } from '../utils/id'
import type { Shape } from '../types'
import { appStore } from './appStore'
import { createStore } from './createStore'
import { documentStore } from './documentStore'

/**
 * Classes, without accounts (see worker/clases.js). The codes of the classes one belongs to are
 * kept in this browser; the teacher's code opens the class anywhere else too. A pupil's sheets
 * stay here: one reaches the teacher only when the pupil sends it.
 */

export interface TeacherClass {
  code: string
  name: string
}

export interface PupilClass {
  code: string
  name: string
  /** How the teacher sees this pupil: a first name and the initial of the surname. */
  pupil: string
  /** Tells this pupil's sheets apart from those of someone who typed the same name. */
  key: string
}

/** An exercise of a class, as opened on the desk: sent back, only the strokes need to travel. */
export interface ExerciseRef {
  code: string
  id: string
  title: string
  bytes: number
}

export interface ClassExercise {
  id: string
  titulo: string
  archivo: string
  bytes: number
  fecha: number
  /** A sheet of the exercise library: only its address is kept. */
  origen: string | null
}

export interface SentSheet {
  id: string
  alumno: string
  clave: string
  titulo: string
  ejercicio: string | null
  bytes: number
  fecha: number
}

export interface TeacherView {
  nombre: string
  profesor: string
  alumnos: string
  creada: number
  bytes: number
  /** Room the class may fill. */
  espacio: number
  ejercicios: ClassExercise[]
  entregas: SentSheet[]
}

export interface PupilView {
  nombre: string
  alumnos: string
  ejercicios: ClassExercise[]
}

const STORAGE_KEY = 'lamina:clases'

const load = (): { teacher: TeacherClass[]; pupil: PupilClass[] } => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { teacher?: TeacherClass[]; pupil?: PupilClass[] } | null
    return { teacher: (saved?.teacher ?? []).filter((c) => c?.code), pupil: (saved?.pupil ?? []).filter((c) => c?.code && c.pupil && c.key) }
  } catch {
    return { teacher: [], pupil: [] }
  }
}

export const classStore = createStore<{ teacher: TeacherClass[]; pupil: PupilClass[] }>(load())

const remember = (patch: Partial<{ teacher: TeacherClass[]; pupil: PupilClass[] }>) => {
  classStore.set(patch)
  const { teacher, pupil } = classStore.get()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ teacher, pupil }))
  } catch {
    /* storage unavailable: the classes last until the page is closed */
  }
}

/** What was typed, as the server keeps it: capitals, without spaces or dashes. */
export const cleanCode = (typed: string) => typed.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isTeacherCode = (code: string) => code.startsWith('P') && code.length === 16
/** A code as it is shown: in groups of three (pupils) or four (teacher). */
export const showCode = (code: string) => code.match(code.length > 8 ? /.{1,4}/g : /.{1,3}/g)?.join('-') ?? code

export class ClassError extends Error {}

const request = async (path: string, init: RequestInit & { code?: string; key?: string } = {}): Promise<Response> => {
  const { code, key, ...rest } = init
  let reply: Response
  try {
    reply = await fetch(`/clases/${path}`, {
      method: 'POST',
      ...rest,
      headers: { ...(code ? { 'X-Codigo': code } : {}), ...(key ? { 'X-Clave': key } : {}), ...(rest.headers ?? {}) },
    })
  } catch {
    throw new ClassError('No hay conexión. Comprueba internet y vuelve a probar.')
  }
  if (reply.ok) return reply
  if (reply.status === 429) throw new ClassError('Demasiados intentos seguidos. Espera un minuto.')
  const said = await reply.json().catch(() => null)
  throw new ClassError(typeof said?.error === 'string' ? said.error : 'No se ha podido hacer. Vuelve a probar en un momento.')
}

const json = async <T>(reply: Response) => (await reply.json()) as T

/** A new class: its codes are kept here, the teacher's to be noted down too. */
export const createClass = async (name: string): Promise<TeacherClass> => {
  const made = await json<{ nombre: string; profesor: string }>(await request('crear', { body: JSON.stringify({ nombre: name }) }))
  const room = { code: made.profesor, name: made.nombre }
  remember({ teacher: [room, ...classStore.get().teacher.filter((c) => c.code !== room.code)] })
  markSeen(room.code, [])
  return room
}

export const teacherView = async (code: string): Promise<TeacherView> => {
  const view = await json<TeacherView>(await request('profesor', { code }))
  // Kept (or brought up to date) here: entering the code once is enough on this browser.
  remember({ teacher: [{ code: view.profesor, name: view.nombre }, ...classStore.get().teacher.filter((c) => c.code !== view.profesor)] })
  return view
}

export const pupilView = (code: string) => request('alumno', { code }).then((r) => json<PupilView>(r))

/** Joins a class with its pupils' code, under a first name and the initial of the surname. */
export const joinClass = async (code: string, pupil: string): Promise<PupilClass> => {
  const view = await pupilView(code)
  const previous = classStore.get().pupil.find((c) => c.code === view.alumnos)
  const room = { code: view.alumnos, name: view.nombre, pupil, key: previous?.key ?? newId() }
  remember({ pupil: [room, ...classStore.get().pupil.filter((c) => c.code !== room.code)] })
  // What was there before joining is not news; the panel still shows it.
  if (!seenIn(room.code)) markSeen(room.code, view.ejercicios.map((x) => x.id))
  return room
}

/** Forgets a class on this browser only; it stays as it is for everyone else. */
export const forgetClass = (code: string) =>
  remember({ teacher: classStore.get().teacher.filter((c) => c.code !== code), pupil: classStore.get().pupil.filter((c) => c.code !== code) })

export const uploadExercise = async (code: string, title: string, fileName: string, pdf: Uint8Array) => {
  const query = new URLSearchParams({ t: title, n: fileName })
  await request(`ejercicio?${query}`, { code, method: 'PUT', body: pdf as BlobPart })
}

/** Puts a sheet of the exercise library in the class (its address, never a copy). */
export const addLibraryExercise = async (code: string, address: string, title: string) => {
  await request('ejercicio-web', { code, body: JSON.stringify({ origen: address, titulo: title }) })
}

export const exercisePdf = async (code: string, id: string) => new Uint8Array(await (await request(`ejercicio/${id}`, { code })).arrayBuffer())

export const deleteExercise = (code: string, id: string) => request(`borrar-ejercicio/${id}`, { code })

/** A sheet a pupil sent, as a project: its PDF and its strokes. */
export const sentSheet = async (code: string, id: string) => {
  const project = decodeProject(new Uint8Array(await (await request(`entrega/${id}`, { code })).arrayBuffer()))
  if (!project) throw new ClassError('La lámina está dañada.')
  return project
}

export const deleteSent = (code: string, id: string) => request(`borrar-entrega/${id}`, { code })

export const deleteClass = async (code: string) => {
  await request('borrar', { code })
  forgetClass(code)
}

/**
 * Sends a sheet to the teacher of a class. On an exercise of that same class, untouched but for
 * the strokes, only the strokes travel. Sending the same sheet again replaces the earlier one.
 */
export const sendSheet = async (
  room: PupilClass,
  title: string,
  sheet: { name: string; bytes: Uint8Array; shapes: Shape[]; page: number },
  exercise?: ExerciseRef,
): Promise<{ replaced: boolean }> => {
  const onExercise = exercise && exercise.code === room.code && exercise.bytes === sheet.bytes.length
  const file = encodeProject({ ...sheet, bytes: onExercise ? new Uint8Array() : sheet.bytes })
  const query = new URLSearchParams({ a: room.pupil, k: room.key, t: title, ...(onExercise ? { e: exercise.id } : {}) })
  const reply = await json<{ reemplaza: boolean }>(await request(`entregar?${query}`, { code: room.code, method: 'PUT', body: file }))
  return { replaced: reply.reemplaza }
}

/** "12 oct, 18:30" */
export const when = (ms: number) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))

/** Tag of the tabs holding a sheet a pupil sent (see openPdf), followed by its id. */
export const SENT_TAG = 'entrega-'

/** A sheet this pupil sent. */
export interface MySheet {
  id: string
  titulo: string
  ejercicio: string | null
  bytes: number
  fecha: number
}

export const mySent = async (room: PupilClass) => (await json<{ entregas: MySheet[] }>(await request('mias', { code: room.code, key: room.key }))).entregas

/** One of the pupil's own sheets, as they sent it, to look at it again or change it. */
export const mySheet = async (room: PupilClass, id: string) => {
  const project = decodeProject(new Uint8Array(await (await request(`mia/${id}`, { code: room.code, key: room.key })).arrayBuffer()))
  if (!project) throw new ClassError('La lámina está dañada.')
  return project
}

export const deleteMine = (room: PupilClass, id: string) => request(`borrar-mia/${id}`, { code: room.code, key: room.key })

/*
 * What is new in each class: exercises a pupil has not seen yet, sheets a teacher has not looked
 * at. What was seen is kept per class in this browser; a class seen for the first time starts with
 * everything in it seen, so joining does not bring a pile of news.
 */
const SEEN_KEY = 'lamina:clases-visto'

const loadSeen = (): Record<string, string[]> => {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string[]>) ?? {}
  } catch {
    return {}
  }
}

export const seenIn = (code: string): ReadonlySet<string> | null => {
  const ids = loadSeen()[code]
  return ids ? new Set(ids) : null
}

export const markSeen = (code: string, ids: readonly string[]) => {
  const seen = loadSeen()
  seen[code] = [...new Set([...(seen[code] ?? []), ...ids])].slice(-500)
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    /* storage unavailable: news come back next visit */
  }
  newsStore.set({ news: newsStore.get().news.filter((n) => !(n.code === code && ids.includes(n.id))) })
}

export interface News {
  /** The exercise or the sent sheet it is about. */
  id: string
  code: string
  className: string
  role: 'teacher' | 'pupil'
  title: string
  /** Who sent it, for a teacher. */
  pupil?: string
}

export const newsStore = createStore<{ news: News[] }>({ news: [] })

/** Asks each class kept here what is new. Quiet when offline or when a class is gone. */
export const checkNews = async () => {
  const news: News[] = []
  const { teacher, pupil } = classStore.get()
  for (const room of pupil) {
    try {
      const view = await request('alumno', { code: room.code }).then((r) => json<PupilView>(r))
      const seen = seenIn(room.code)
      if (!seen) markSeen(room.code, view.ejercicios.map((x) => x.id))
      else for (const x of view.ejercicios) if (!seen.has(x.id)) news.push({ id: x.id, code: room.code, className: view.nombre, role: 'pupil', title: x.titulo })
    } catch {
      /* next time */
    }
  }
  for (const room of teacher) {
    try {
      const view = await request('profesor', { code: room.code }).then((r) => json<TeacherView>(r))
      const seen = seenIn(room.code)
      if (!seen) markSeen(room.code, view.entregas.map((x) => x.id))
      else for (const x of view.entregas) if (!seen.has(x.id)) news.push({ id: x.id, code: room.code, className: view.nombre, role: 'teacher', title: x.titulo, pupil: x.alumno })
    } catch {
      /* next time */
    }
  }
  newsStore.set({ news })
}

/** Per tab, the strokes as last sent from it (or as it was opened): changes since are unsent. */
export const sentBaseline = new Map<string, unknown>()

/** The sheet on the desk has just been sent: its strokes, as they are, are the sent ones. */
export const markSentNow = () => {
  const { activeTab } = appStore.get()
  if (activeTab) sentBaseline.set(activeTab, documentStore.get().shapes)
}
