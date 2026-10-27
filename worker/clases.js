/**
 * Classes, without accounts: a teacher makes a class and gets two codes, one of their own and one
 * for the pupils. With the teacher's code the class is opened from any browser: the exercises put
 * up and the sheets pupils chose to send. With the pupils' code one joins, sees the exercises and
 * can send a sheet; nothing reaches the teacher unless the pupil sends it.
 *
 *   POST /clases/crear                { nombre }                      → { nombre, profesor, alumnos }
 *   POST /clases/profesor             (teacher's code)                → the class, its exercises and what was sent
 *   POST /clases/alumno               (pupils' code)                  → the class and its exercises
 *   PUT  /clases/ejercicio?t=&n=      (teacher's code) the PDF        → { id }
 *   POST /clases/ejercicio/<id>       (either code)                   → the PDF
 *   POST /clases/borrar-ejercicio/<id>  (teacher's code)
 *   PUT  /clases/entregar?a=&k=&t=&e= (pupils' code) a project file   → { id }
 *   POST /clases/entrega/<id>         (teacher's code)                → the sheet as a project file
 *   POST /clases/borrar-entrega/<id>  (teacher's code)
 *   POST /clases/borrar               (teacher's code)                the whole class, for good
 *
 * The code goes in the X-Codigo header, never in the address. Files are kept in the D1 database
 * in pieces (a row holds at most 2 MB), all of them within BUDGET. A sheet sent on an exercise of
 * the class keeps only its strokes: the PDF is the exercise's. Classes nobody has opened for
 * IDLE_DAYS are deleted with everything in them.
 */
import { slowDown, tooMany } from './limites.js'
import { tables as registroTables } from './registro.js'

const BUDGET = 150 * 1024 * 1024
const MAX_EXERCISE = 12 * 1024 * 1024
const MAX_SENT = 14 * 1024 * 1024
/** Room for one class: no class may fill the space of all the others. */
const CLASS_BUDGET = 60 * 1024 * 1024
const PIECE = 1024 * 1024
const IDLE_DAYS = 180
const PER_MINUTE = { crear: 6, profesor: 30, alumno: 30, ejercicio: 40, 'borrar-ejercicio': 30, entregar: 10, entrega: 60, 'borrar-entrega': 60, borrar: 6 }

/** Letters and figures that cannot be mistaken for each other (no 0/O, 1/I/L). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const code = (length) => [...crypto.getRandomValues(new Uint8Array(length))].map((b) => ALPHABET[b % ALPHABET.length]).join('')
const randomId = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('')
/** What was typed, as it is kept: capitals, without spaces or dashes. */
const clean = (typed) => String(typed ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const ID = /^[a-f0-9]{24}$/
const MAGIC = new TextEncoder().encode('LAMINA1\n')

let ready = false
const tables = async (db) => {
  if (ready) return
  await registroTables(db)
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS clases (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, profesor TEXT NOT NULL UNIQUE, alumnos TEXT NOT NULL UNIQUE, creada INTEGER NOT NULL, usada INTEGER NOT NULL, bytes INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS clase_ejercicios (id TEXT PRIMARY KEY, clase INTEGER NOT NULL, titulo TEXT NOT NULL, archivo TEXT NOT NULL, bytes INTEGER NOT NULL, fecha INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS clase_entregas (id TEXT PRIMARY KEY, clase INTEGER NOT NULL, alumno TEXT NOT NULL, clave TEXT NOT NULL, titulo TEXT NOT NULL, ejercicio TEXT, dibujo TEXT, bytes INTEGER NOT NULL, fecha INTEGER NOT NULL)'),
    // The files themselves, in pieces: of an exercise ('e' + id) or of a sheet sent with its own PDF ('s' + id).
    db.prepare('CREATE TABLE IF NOT EXISTS clase_trozos (dueno TEXT NOT NULL, n INTEGER NOT NULL, datos BLOB NOT NULL, PRIMARY KEY (dueno, n))'),
    db.prepare("INSERT OR IGNORE INTO uso (clave, bytes) VALUES ('clases', 0)"),
  ])
  ready = true
}

const answer = (status, body = { ok: status < 300 }) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const failed = (status, error) => answer(status, { ok: false, error })

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)

const used = async (db) => (await db.prepare("SELECT bytes FROM uso WHERE clave = 'clases'").first())?.bytes ?? 0
const addUsage = (db, classId, delta) => [
  db.prepare("UPDATE uso SET bytes = MAX(0, bytes + ?1) WHERE clave = 'clases'").bind(delta),
  db.prepare('UPDATE clases SET bytes = MAX(0, bytes + ?2) WHERE id = ?1').bind(classId, delta),
]

const storePieces = (db, owner, bytes) => {
  const writes = []
  for (let i = 0, n = 0; i < bytes.length; i += PIECE, n++) writes.push(db.prepare('INSERT OR REPLACE INTO clase_trozos (dueno, n, datos) VALUES (?1, ?2, ?3)').bind(owner, n, bytes.subarray(i, i + PIECE)))
  return writes
}
const readPieces = async (db, owner) => {
  const rows = (await db.prepare('SELECT datos FROM clase_trozos WHERE dueno = ?1 ORDER BY n').bind(owner).all()).results
  if (!rows.length) return null
  const parts = rows.map((r) => new Uint8Array(r.datos))
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const dropPieces = (db, owner) => db.prepare('DELETE FROM clase_trozos WHERE dueno = ?1').bind(owner)

/** The project file (.lamina) the app opens: its header with the strokes, then the PDF. */
const projectFile = (name, drawing, pdf) => {
  const header = new TextEncoder().encode(JSON.stringify({ version: 1, name, shapes: drawing.shapes ?? [], page: drawing.page ?? 0 }))
  const out = new Uint8Array(MAGIC.length + 4 + header.length + pdf.length)
  out.set(MAGIC)
  new DataView(out.buffer).setUint32(MAGIC.length, header.length)
  out.set(header, MAGIC.length + 4)
  out.set(pdf, MAGIC.length + 4 + header.length)
  return out
}

/** A project file sent by the app, split into its header and its PDF; null when it is not one. */
const readProject = (bytes) => {
  if (bytes.length < MAGIC.length + 4 || !MAGIC.every((b, i) => bytes[i] === b)) return null
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(MAGIC.length)
  const start = MAGIC.length + 4
  if (start + length > bytes.length) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + length)))
    if (!Array.isArray(header?.shapes)) return null
    return { shapes: header.shapes, page: Number.isFinite(header.page) ? header.page : 0, pdf: bytes.subarray(start + length) }
  } catch {
    return null
  }
}

const isPdf = (bytes) => new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')

/** Deletes a class and everything in it. */
const dropClass = async (db, classId, bytes) => {
  const owners = [
    ...(await db.prepare("SELECT 'e' || id AS dueno FROM clase_ejercicios WHERE clase = ?1").bind(classId).all()).results,
    ...(await db.prepare("SELECT 's' || id AS dueno FROM clase_entregas WHERE clase = ?1").bind(classId).all()).results,
  ]
  await db.batch([
    ...owners.map((o) => dropPieces(db, o.dueno)),
    db.prepare('DELETE FROM clase_ejercicios WHERE clase = ?1').bind(classId),
    db.prepare('DELETE FROM clase_entregas WHERE clase = ?1').bind(classId),
    db.prepare('DELETE FROM clases WHERE id = ?1').bind(classId),
    db.prepare("UPDATE uso SET bytes = MAX(0, bytes - ?1) WHERE clave = 'clases'").bind(bytes ?? 0),
  ])
}

/** Now and then, the classes nobody has opened for IDLE_DAYS go. */
const sweep = async (db) => {
  const old = (await db.prepare('SELECT id, bytes FROM clases WHERE usada < ?1 LIMIT 5').bind(Date.now() - IDLE_DAYS * 86400000).all()).results
  for (const c of old) await dropClass(db, c.id, c.bytes)
}

const exercisesOf = async (db, classId) =>
  (await db.prepare('SELECT id, titulo, archivo, bytes, fecha FROM clase_ejercicios WHERE clase = ?1 ORDER BY fecha DESC').bind(classId).all()).results

export const clases = async (request, env, path) => {
  if (!env.DB) return failed(503, 'Las clases no están disponibles ahora mismo.')
  const [action, id] = path.split('/')
  if (!(action in PER_MINUTE)) return failed(404, 'No encontrado.')
  if (tooMany(request, 'clases-' + action, PER_MINUTE[action])) return slowDown()
  const db = env.DB
  await tables(db)
  const now = Date.now()
  if (Math.random() < 0.02) await sweep(db)

  if (action === 'crear') {
    if (request.method !== 'POST') return failed(405, 'Método no permitido.')
    let name = ''
    try {
      name = text((await request.json())?.nombre, 80)
    } catch {
      /* no name */
    }
    if (!name) return failed(400, 'Ponle un nombre a la clase.')
    const teacher = 'P' + code(15)
    const pupils = code(6)
    await db.prepare('INSERT INTO clases (nombre, profesor, alumnos, creada, usada) VALUES (?1, ?2, ?3, ?4, ?4)').bind(name, teacher, pupils, now).run()
    return answer(200, { ok: true, nombre: name, profesor: teacher, alumnos: pupils })
  }

  // Everything else is done with one of the two codes of a class.
  const given = clean(request.headers.get('X-Codigo'))
  if (!given || given.length > 20) return failed(400, 'Falta el código de la clase.')
  const asTeacher = given.startsWith('P')
  const room = await db.prepare(`SELECT * FROM clases WHERE ${asTeacher ? 'profesor' : 'alumnos'} = ?1`).bind(given).first()
  if (!room) return failed(404, asTeacher ? 'No hay ninguna clase con ese código de profesor.' : 'No hay ninguna clase con ese código.')
  const teacherOnly = ['profesor', 'borrar-ejercicio', 'entrega', 'borrar-entrega', 'borrar'].includes(action) || (action === 'ejercicio' && request.method === 'PUT')
  if (teacherOnly && !asTeacher) return failed(403, 'Esto solo lo puede hacer el profesor de la clase.')
  if (action === 'entregar' && asTeacher) return failed(403, 'Las láminas las envían los alumnos, con el código de alumnos.')
  await db.prepare('UPDATE clases SET usada = ?2 WHERE id = ?1').bind(room.id, now).run()

  if (action === 'profesor') {
    const sent = (
      await db.prepare('SELECT id, alumno, clave, titulo, ejercicio, bytes, fecha FROM clase_entregas WHERE clase = ?1 ORDER BY fecha DESC').bind(room.id).all()
    ).results
    return answer(200, { ok: true, nombre: room.nombre, profesor: room.profesor, alumnos: room.alumnos, creada: room.creada, bytes: room.bytes, ejercicios: await exercisesOf(db, room.id), entregas: sent })
  }

  if (action === 'alumno') return answer(200, { ok: true, nombre: room.nombre, alumnos: room.alumnos, ejercicios: await exercisesOf(db, room.id) })

  if (action === 'ejercicio' && request.method === 'PUT') {
    const url = new URL(request.url)
    if (Number(request.headers.get('content-length') ?? 0) > MAX_EXERCISE) return failed(413, 'El archivo es demasiado grande (máximo 12 MB).')
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_EXERCISE) return failed(413, 'El archivo es demasiado grande (máximo 12 MB).')
    if (!isPdf(bytes)) return failed(400, 'Solo se pueden subir PDF o imágenes.')
    if (room.bytes + bytes.length > CLASS_BUDGET) return failed(507, 'Esta clase ya no tiene más espacio. Borra ejercicios o láminas antiguas.')
    if ((await used(db)) + bytes.length > BUDGET) return failed(507, 'No queda espacio para más archivos ahora mismo.')
    const exercise = randomId()
    const file = text(url.searchParams.get('n'), 160) || 'ejercicio.pdf'
    const title = text(url.searchParams.get('t'), 120) || file.replace(/\.pdf$/i, '')
    await db.batch([
      ...storePieces(db, 'e' + exercise, bytes),
      db.prepare('INSERT INTO clase_ejercicios (id, clase, titulo, archivo, bytes, fecha) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(exercise, room.id, title, file, bytes.length, now),
      ...addUsage(db, room.id, bytes.length),
    ])
    return answer(200, { ok: true, id: exercise })
  }

  if (action === 'ejercicio' || action === 'borrar-ejercicio') {
    if (request.method !== 'POST' || !ID.test(id ?? '')) return failed(400, 'Ejercicio no válido.')
    const exercise = await db.prepare('SELECT * FROM clase_ejercicios WHERE id = ?1 AND clase = ?2').bind(id, room.id).first()
    if (!exercise) return failed(404, 'Ese ejercicio ya no está en la clase.')
    if (action === 'ejercicio') {
      const pdf = await readPieces(db, 'e' + id)
      return pdf ? new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } }) : failed(404, 'No se encuentra el archivo.')
    }
    // The sheets sent on it go with it: they were drawn on its PDF.
    const onIt = (await db.prepare('SELECT id, bytes FROM clase_entregas WHERE ejercicio = ?1').bind(id).all()).results
    const freed = exercise.bytes + onIt.reduce((n, s) => n + s.bytes, 0)
    await db.batch([
      dropPieces(db, 'e' + id),
      db.prepare('DELETE FROM clase_entregas WHERE ejercicio = ?1').bind(id),
      db.prepare('DELETE FROM clase_ejercicios WHERE id = ?1').bind(id),
      ...addUsage(db, room.id, -freed),
    ])
    return answer(200)
  }

  if (action === 'entregar') {
    if (request.method !== 'PUT') return failed(405, 'Método no permitido.')
    const url = new URL(request.url)
    const pupil = text(url.searchParams.get('a'), 60)
    const key = String(url.searchParams.get('k') ?? '')
    const title = text(url.searchParams.get('t'), 120) || 'Lámina'
    const exerciseId = url.searchParams.get('e')
    if (!pupil || !/^[a-z0-9-]{8,40}$/.test(key)) return failed(400, 'Falta tu nombre.')
    if (Number(request.headers.get('content-length') ?? 0) > MAX_SENT) return failed(413, 'La lámina es demasiado grande para enviarla (máximo 14 MB).')
    const bytes = new Uint8Array(await request.arrayBuffer())
    const sent = bytes.length <= MAX_SENT ? readProject(bytes) : null
    if (!sent) return failed(400, 'No se ha podido leer la lámina.')
    // On an exercise of this class the PDF is already here: only the strokes are kept.
    const exercise = exerciseId && ID.test(exerciseId) ? await db.prepare('SELECT id FROM clase_ejercicios WHERE id = ?1 AND clase = ?2').bind(exerciseId, room.id).first() : null
    if (!exercise && !isPdf(sent.pdf)) return failed(400, 'No se ha podido leer la lámina.')
    const drawing = JSON.stringify({ shapes: sent.shapes, page: sent.page })
    const size = drawing.length + (exercise ? 0 : sent.pdf.length)
    // Sending the same sheet again replaces what was sent before.
    const before = exercise
      ? await db.prepare('SELECT id, bytes FROM clase_entregas WHERE clase = ?1 AND clave = ?2 AND ejercicio = ?3').bind(room.id, key, exercise.id).first()
      : await db.prepare('SELECT id, bytes FROM clase_entregas WHERE clase = ?1 AND clave = ?2 AND ejercicio IS NULL AND titulo = ?3').bind(room.id, key, title).first()
    const freed = before?.bytes ?? 0
    if (room.bytes - freed + size > CLASS_BUDGET) return failed(507, 'La clase de tu profesor no tiene más espacio. Avísale.')
    if ((await used(db)) - freed + size > BUDGET) return failed(507, 'No queda espacio para más láminas ahora mismo.')
    const sheet = randomId()
    await db.batch([
      ...(before ? [dropPieces(db, 's' + before.id), db.prepare('DELETE FROM clase_entregas WHERE id = ?1').bind(before.id)] : []),
      ...(exercise ? [] : storePieces(db, 's' + sheet, sent.pdf)),
      db.prepare('INSERT INTO clase_entregas (id, clase, alumno, clave, titulo, ejercicio, dibujo, bytes, fecha) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)').bind(sheet, room.id, pupil, key, title, exercise?.id ?? null, drawing, size, now),
      ...addUsage(db, room.id, size - freed),
    ])
    return answer(200, { ok: true, id: sheet, reemplaza: Boolean(before) })
  }

  if (action === 'entrega' || action === 'borrar-entrega') {
    if (request.method !== 'POST' || !ID.test(id ?? '')) return failed(400, 'Lámina no válida.')
    const sheet = await db.prepare('SELECT * FROM clase_entregas WHERE id = ?1 AND clase = ?2').bind(id, room.id).first()
    if (!sheet) return failed(404, 'Esa lámina ya no está en la clase.')
    if (action === 'borrar-entrega') {
      await db.batch([dropPieces(db, 's' + id), db.prepare('DELETE FROM clase_entregas WHERE id = ?1').bind(id), ...addUsage(db, room.id, -sheet.bytes)])
      return answer(200)
    }
    const pdf = await readPieces(db, sheet.ejercicio ? 'e' + sheet.ejercicio : 's' + id)
    if (!pdf) return failed(404, 'No se encuentra el archivo de esta lámina.')
    let drawing = {}
    try {
      drawing = JSON.parse(sheet.dibujo ?? '{}') ?? {}
    } catch {
      /* no strokes */
    }
    return new Response(projectFile(`${sheet.alumno} · ${sheet.titulo}.pdf`, drawing, pdf), { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' } })
  }

  if (action === 'borrar') {
    if (request.method !== 'POST') return failed(405, 'Método no permitido.')
    await dropClass(db, room.id, room.bytes)
    return answer(200)
  }
  return failed(404, 'No encontrado.')
}

/** Every class, for the creator's panel: to give a teacher who lost their code their class back. */
export const allClasses = async (db) => {
  await tables(db)
  return (
    await db
      .prepare(
        'SELECT c.id, c.nombre, c.profesor, c.alumnos, c.creada, c.usada, c.bytes, (SELECT COUNT(*) FROM clase_ejercicios e WHERE e.clase = c.id) AS ejercicios, (SELECT COUNT(*) FROM clase_entregas s WHERE s.clase = c.id) AS entregas, (SELECT COUNT(DISTINCT clave) FROM clase_entregas s WHERE s.clase = c.id) AS alumnos_enviaron FROM clases c ORDER BY c.usada DESC LIMIT 500',
      )
      .all()
  ).results
}

export const IDLE_DAYS_CLASSES = IDLE_DAYS

/** A code as it is shown: in groups of three (pupils) or four (teacher), easier to copy by hand. */
export const showCode = (value) => String(value).match(value.length > 8 ? /.{1,4}/g : /.{1,3}/g)?.join('-') ?? value
