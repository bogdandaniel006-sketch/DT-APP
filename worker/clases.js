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
 *   POST /clases/ejercicio-web        (teacher's code) { origen, titulo } → { id }   a sheet of the library
 *   POST /clases/ejercicio/<id>       (either code)                   → the PDF
 *   POST /clases/borrar-ejercicio/<id>  (teacher's code)
 *   PUT  /clases/entregar?a=&k=&t=&e= (pupils' code) a project file   → { id }
 *   POST /clases/entrega/<id>         (teacher's code)                → the sheet as a project file
 *   POST /clases/borrar-entrega/<id>  (teacher's code)
 *   POST /clases/borrar               (teacher's code)                the whole class, for good
 *   POST /clases/unirme               (pupils' code, X-Clave) { nombre }  the pupil, on the class list
 *   POST /clases/mias                 (pupils' code, X-Clave)         → what this pupil sent
 *   POST /clases/mia/<id>             (pupils' code, X-Clave)         → one of them, as a project file
 *   POST /clases/borrar-mia/<id>      (pupils' code, X-Clave)
 *
 * The code goes in the X-Codigo header, never in the address. The class, its exercises and what
 * was sent are listed in the main database (DB); the files themselves go to the databases kept for
 * classes (see almacen.js). A sheet sent on an exercise of the class keeps only its strokes: the PDF
 * is the exercise's. Sheets of the exercise library are never copied: an exercise taken from it
 * keeps only its address (origen) and is brought from its site each time. Classes nobody has opened for IDLE_DAYS are deleted with everything in them.
 */
import { drop, put, read, stream } from './almacen.js'
import { fetchSheet, originalOf } from './ejercicios.js'
import { slowDown, tooMany } from './limites.js'
import { ORIGIN, tables as registroTables } from './registro.js'

const MAX_EXERCISE = 40 * 1024 * 1024
const MAX_SENT = 40 * 1024 * 1024
/** Room for one class: no class may fill the space of all the others. */
export const CLASS_BUDGET = 250 * 1024 * 1024
const IDLE_DAYS = 180
const PER_MINUTE = { crear: 6, profesor: 30, alumno: 30, ejercicio: 40, 'ejercicio-web': 40, 'borrar-ejercicio': 30, entregar: 10, entrega: 60, 'borrar-entrega': 60, borrar: 6, mias: 30, mia: 60, 'borrar-mia': 30, unirme: 10 }

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
    // `almacen`: which of the class databases holds the file (an exercise's PDF, or the project file a pupil sent).
    db.prepare('CREATE TABLE IF NOT EXISTS ejercicios_clase (id TEXT PRIMARY KEY, clase INTEGER NOT NULL, titulo TEXT NOT NULL, archivo TEXT NOT NULL, bytes INTEGER NOT NULL, fecha INTEGER NOT NULL, almacen INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS entregas_clase (id TEXT PRIMARY KEY, clase INTEGER NOT NULL, alumno TEXT NOT NULL, clave TEXT NOT NULL, titulo TEXT NOT NULL, ejercicio TEXT, bytes INTEGER NOT NULL, fecha INTEGER NOT NULL, almacen INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS ejercicios_clase_clase ON ejercicios_clase (clase)'),
    db.prepare('CREATE INDEX IF NOT EXISTS entregas_clase_clase ON entregas_clase (clase)'),
    // The class list: every pupil who joined, under the name they gave.
    db.prepare('CREATE TABLE IF NOT EXISTS alumnos_clase (clase INTEGER NOT NULL, clave TEXT NOT NULL, nombre TEXT NOT NULL, unido INTEGER NOT NULL, PRIMARY KEY (clase, clave))'),
  ])
  // Added later: the address of a sheet of the library (then nothing is kept, and almacen is 0).
  try {
    await db.prepare('ALTER TABLE ejercicios_clase ADD COLUMN origen TEXT').run()
  } catch {
    /* already there */
  }
  ready = true
}

/** A sheet of the library, brought from its site (never kept), as bytes. */
const librarySheet = async (origin) => {
  const address = ORIGIN.test(origin ?? '') ? originalOf(origin.slice('/ejercicios/'.length)) : null
  const sheet = address ? await fetchSheet(address) : null
  return sheet ? new Uint8Array(await sheet.arrayBuffer()) : null
}

const answer = (status, body = { ok: status < 300 }) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const failed = (status, error) => answer(status, { ok: false, error })
const FULL = 'No queda espacio para más archivos ahora mismo. Avisa al autor de Lámina.'

const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)

const addUsage = (db, classId, delta) => db.prepare('UPDATE clases SET bytes = MAX(0, bytes + ?2) WHERE id = ?1').bind(classId, delta)

/** A project file sent by the app: where its PDF starts; null when it is not one. */
const projectPdfStart = (bytes) => {
  if (bytes.length < MAGIC.length + 4 || !MAGIC.every((b, i) => bytes[i] === b)) return null
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(MAGIC.length)
  const start = MAGIC.length + 4
  if (start + length > bytes.length) return null
  try {
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + length)))
    return Array.isArray(header?.shapes) ? start + length : null
  } catch {
    return null
  }
}

const print = async (key) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('clave:' + key)))].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')

const isPdf = (bytes) => new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')

/** Deletes a class and everything in it. */
const dropClass = async (env, classId) => {
  const db = env.DB
  const exercises = (await db.prepare('SELECT id, bytes, almacen FROM ejercicios_clase WHERE clase = ?1').bind(classId).all()).results
  const sent = (await db.prepare('SELECT id, bytes, almacen FROM entregas_clase WHERE clase = ?1').bind(classId).all()).results
  for (const x of exercises) if (x.almacen) await drop(env, 'clases', x.almacen, 'e' + x.id, x.bytes)
  for (const s of sent) await drop(env, 'clases', s.almacen, 's' + s.id, s.bytes)
  await db.batch([
    db.prepare('DELETE FROM ejercicios_clase WHERE clase = ?1').bind(classId),
    db.prepare('DELETE FROM entregas_clase WHERE clase = ?1').bind(classId),
    db.prepare('DELETE FROM alumnos_clase WHERE clase = ?1').bind(classId),
    db.prepare('DELETE FROM clases WHERE id = ?1').bind(classId),
  ])
}

/** Now and then, the classes nobody has opened for IDLE_DAYS go. */
const sweep = async (env) => {
  const old = (await env.DB.prepare('SELECT id FROM clases WHERE usada < ?1 LIMIT 3').bind(Date.now() - IDLE_DAYS * 86400000).all()).results
  for (const c of old) await dropClass(env, c.id)
}

/** Puts a pupil on the class list, or brings their name up to date. */
const enrol = (db, classId, key, name, now) =>
  db.prepare('INSERT INTO alumnos_clase (clase, clave, nombre, unido) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (clase, clave) DO UPDATE SET nombre = ?3').bind(classId, key, name, now)

const exercisesOf = async (db, classId) =>
  (await db.prepare('SELECT id, titulo, archivo, bytes, fecha, origen FROM ejercicios_clase WHERE clase = ?1 ORDER BY fecha DESC').bind(classId).all()).results

export const clases = async (request, env, path) => {
  if (!env.DB) return failed(503, 'Las clases no están disponibles ahora mismo.')
  const [action, id] = path.split('/')
  if (!(action in PER_MINUTE)) return failed(404, 'No encontrado.')
  if (tooMany(request, 'clases-' + action, PER_MINUTE[action])) return slowDown()
  const db = env.DB
  await tables(db)
  const now = Date.now()
  if (Math.random() < 0.02) await sweep(env)

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
  const teacherOnly = ['profesor', 'ejercicio-web', 'borrar-ejercicio', 'entrega', 'borrar-entrega', 'borrar'].includes(action) || (action === 'ejercicio' && request.method === 'PUT')
  if (teacherOnly && !asTeacher) return failed(403, 'Esto solo lo puede hacer el profesor de la clase.')
  if (action === 'entregar' && asTeacher) return failed(403, 'Las láminas las envían los alumnos, con el código de alumnos.')
  await db.prepare('UPDATE clases SET usada = ?2 WHERE id = ?1').bind(room.id, now).run()

  if (action === 'profesor') {
    const rows = (await db.prepare('SELECT id, alumno, clave, titulo, ejercicio, bytes, fecha FROM entregas_clase WHERE clase = ?1 ORDER BY fecha DESC').bind(room.id).all()).results
    // Each pupil's key stays theirs: the teacher gets a print of it, enough to tell devices apart.
    const sent = await Promise.all(rows.map(async (r) => ({ ...r, clave: await print(r.clave) })))
    const enrolled = (await db.prepare('SELECT clave, nombre, unido FROM alumnos_clase WHERE clase = ?1').bind(room.id).all()).results
    const list = await Promise.all(enrolled.map(async (p) => ({ clave: await print(p.clave), nombre: p.nombre, unido: p.unido })))
    // Pupils who sent before there was a list are on it too, under the name they sent with.
    for (const r of sent) if (!list.some((p) => p.clave === r.clave)) list.push({ clave: r.clave, nombre: r.alumno, unido: r.fecha })
    return answer(200, {
      ok: true,
      nombre: room.nombre,
      profesor: room.profesor,
      alumnos: room.alumnos,
      creada: room.creada,
      bytes: room.bytes,
      espacio: CLASS_BUDGET,
      ejercicios: await exercisesOf(db, room.id),
      entregas: sent,
      lista: list,
    })
  }

  if (action === 'alumno') return answer(200, { ok: true, nombre: room.nombre, alumnos: room.alumnos, ejercicios: await exercisesOf(db, room.id) })

  if (action === 'ejercicio' && request.method === 'PUT') {
    const url = new URL(request.url)
    const tooBig = 'El archivo es demasiado grande (máximo 40 MB).'
    if (Number(request.headers.get('content-length') ?? 0) > MAX_EXERCISE) return failed(413, tooBig)
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_EXERCISE) return failed(413, tooBig)
    if (!isPdf(bytes)) return failed(400, 'Solo se pueden subir PDF o imágenes.')
    if (room.bytes + bytes.length > CLASS_BUDGET) return failed(507, 'Esta clase ya no tiene más espacio. Borra ejercicios o láminas antiguas.')
    const exercise = randomId()
    const where = await put(env, 'clases', 'e' + exercise, bytes)
    if (!where) return failed(507, FULL)
    const file = text(url.searchParams.get('n'), 160) || 'ejercicio.pdf'
    const title = text(url.searchParams.get('t'), 120) || file.replace(/\.pdf$/i, '')
    await db.batch([
      db.prepare('INSERT INTO ejercicios_clase (id, clase, titulo, archivo, bytes, fecha, almacen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(exercise, room.id, title, file, bytes.length, now, where),
      addUsage(db, room.id, bytes.length),
    ])
    return answer(200, { ok: true, id: exercise })
  }

  if (action === 'ejercicio-web') {
    if (request.method !== 'POST') return failed(405, 'Método no permitido.')
    let body = {}
    try {
      body = (await request.json()) ?? {}
    } catch {
      /* nothing sent */
    }
    const origin = typeof body.origen === 'string' ? body.origen : ''
    if (!ORIGIN.test(origin) || !originalOf(origin.slice('/ejercicios/'.length))) return failed(400, 'Ese ejercicio no es de la biblioteca.')
    const already = await db.prepare('SELECT id FROM ejercicios_clase WHERE clase = ?1 AND origen = ?2').bind(room.id, origin).first()
    if (already) return answer(200, { ok: true, id: already.id })
    const exercise = randomId()
    const file = decodeURIComponent(origin.split('/').pop() ?? 'ejercicio.pdf')
    const title = text(body.titulo, 120) || file.replace(/.pdf$/i, '')
    await db
      .prepare('INSERT INTO ejercicios_clase (id, clase, titulo, archivo, bytes, fecha, almacen, origen) VALUES (?1, ?2, ?3, ?4, 0, ?5, 0, ?6)')
      .bind(exercise, room.id, title, file, now, origin)
      .run()
    return answer(200, { ok: true, id: exercise })
  }

  if (action === 'ejercicio' || action === 'borrar-ejercicio') {
    if (request.method !== 'POST' || !ID.test(id ?? '')) return failed(400, 'Ejercicio no válido.')
    const exercise = await db.prepare('SELECT * FROM ejercicios_clase WHERE id = ?1 AND clase = ?2').bind(id, room.id).first()
    if (!exercise) return failed(404, 'Ese ejercicio ya no está en la clase.')
    if (action === 'ejercicio' && exercise.origen) {
      const pdf = await librarySheet(exercise.origen)
      return pdf ? new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' } }) : failed(502, 'No se ha podido traer la ficha de su web. Prueba en un rato.')
    }
    if (action === 'ejercicio') {
      const pdf = await stream(env, 'clases', exercise.almacen, 'e' + id)
      return pdf
        ? new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(exercise.bytes), 'Cache-Control': 'no-store' } })
        : failed(404, 'No se encuentra el archivo.')
    }
    // The sheets sent on it go with it: they were drawn on its PDF.
    const onIt = (await db.prepare('SELECT id, bytes, almacen FROM entregas_clase WHERE ejercicio = ?1').bind(id).all()).results
    if (exercise.almacen) await drop(env, 'clases', exercise.almacen, 'e' + id, exercise.bytes)
    for (const s of onIt) await drop(env, 'clases', s.almacen, 's' + s.id, s.bytes)
    await db.batch([
      db.prepare('DELETE FROM entregas_clase WHERE ejercicio = ?1').bind(id),
      db.prepare('DELETE FROM ejercicios_clase WHERE id = ?1').bind(id),
      addUsage(db, room.id, -(exercise.bytes + onIt.reduce((n, s) => n + s.bytes, 0))),
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
    const tooBig = 'La lámina es demasiado grande para enviarla (máximo 40 MB).'
    if (Number(request.headers.get('content-length') ?? 0) > MAX_SENT) return failed(413, tooBig)
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_SENT) return failed(413, tooBig)
    const pdfStart = projectPdfStart(bytes)
    if (pdfStart === null) return failed(400, 'No se ha podido leer la lámina.')
    // On an exercise of this class the PDF is already here: only the strokes come, and are kept.
    const exercise = exerciseId && ID.test(exerciseId) ? await db.prepare('SELECT id FROM ejercicios_clase WHERE id = ?1 AND clase = ?2').bind(exerciseId, room.id).first() : null
    const kept = exercise ? bytes.subarray(0, pdfStart) : bytes
    if (!exercise && !isPdf(bytes.subarray(pdfStart))) return failed(400, 'No se ha podido leer la lámina.')
    // Sending the same sheet again replaces what was sent before.
    const before = exercise
      ? await db.prepare('SELECT id, bytes, almacen FROM entregas_clase WHERE clase = ?1 AND clave = ?2 AND ejercicio = ?3').bind(room.id, key, exercise.id).first()
      : await db.prepare('SELECT id, bytes, almacen FROM entregas_clase WHERE clase = ?1 AND clave = ?2 AND ejercicio IS NULL AND titulo = ?3').bind(room.id, key, title).first()
    const freed = before?.bytes ?? 0
    if (room.bytes - freed + kept.length > CLASS_BUDGET) return failed(507, 'La clase de tu profesor no tiene más espacio. Avísale.')
    const sheet = randomId()
    const where = await put(env, 'clases', 's' + sheet, kept)
    if (!where) return failed(507, FULL)
    if (before) await drop(env, 'clases', before.almacen, 's' + before.id, before.bytes)
    await db.batch([
      ...(before ? [db.prepare('DELETE FROM entregas_clase WHERE id = ?1').bind(before.id)] : []),
      db
        .prepare('INSERT INTO entregas_clase (id, clase, alumno, clave, titulo, ejercicio, bytes, fecha, almacen) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
        .bind(sheet, room.id, pupil, key, title, exercise?.id ?? null, kept.length, now, where),
      addUsage(db, room.id, kept.length - freed),
      enrol(db, room.id, key, pupil, now),
    ])
    return answer(200, { ok: true, id: sheet, reemplaza: Boolean(before) })
  }

  if (action === 'entrega' || action === 'borrar-entrega') {
    if (request.method !== 'POST' || !ID.test(id ?? '')) return failed(400, 'Lámina no válida.')
    const sheet = await db.prepare('SELECT * FROM entregas_clase WHERE id = ?1 AND clase = ?2').bind(id, room.id).first()
    if (!sheet) return failed(404, 'Esa lámina ya no está en la clase.')
    if (action === 'borrar-entrega') {
      await drop(env, 'clases', sheet.almacen, 's' + id, sheet.bytes)
      await db.batch([db.prepare('DELETE FROM entregas_clase WHERE id = ?1').bind(id), addUsage(db, room.id, -sheet.bytes)])
      return answer(200)
    }
    return serveSheet(env, sheet)
  }

  if (action === 'mias' || action === 'mia' || action === 'borrar-mia' || action === 'unirme') {
    const key = String(request.headers.get('X-Clave') ?? '')
    if (!/^[a-z0-9-]{8,40}$/.test(key)) return failed(400, 'Falta tu clave de alumno.')
    if (action === 'unirme') {
      let name = ''
      try {
        name = text((await request.json())?.nombre, 60)
      } catch {
        /* no name */
      }
      if (!name) return failed(400, 'Falta tu nombre.')
      await enrol(db, room.id, key, name, now).run()
      return answer(200)
    }
    if (action === 'mias') {
      const mine = (await db.prepare('SELECT id, titulo, ejercicio, bytes, fecha FROM entregas_clase WHERE clase = ?1 AND clave = ?2 ORDER BY fecha DESC').bind(room.id, key).all()).results
      return answer(200, { ok: true, entregas: mine })
    }
    if (request.method !== 'POST' || !ID.test(id ?? '')) return failed(400, 'Lámina no válida.')
    const sheet = await db.prepare('SELECT * FROM entregas_clase WHERE id = ?1 AND clase = ?2 AND clave = ?3').bind(id, room.id, key).first()
    if (!sheet) return failed(404, 'Esa lámina ya no está en la clase.')
    if (action === 'borrar-mia') {
      await drop(env, 'clases', sheet.almacen, 's' + id, sheet.bytes)
      await db.batch([db.prepare('DELETE FROM entregas_clase WHERE id = ?1').bind(id), addUsage(db, room.id, -sheet.bytes)])
      return answer(200)
    }
    return serveSheet(env, sheet)
  }

  if (action === 'borrar') {
    if (request.method !== 'POST') return failed(405, 'Método no permitido.')
    await dropClass(env, room.id)
    return answer(200)
  }
  return failed(404, 'No encontrado.')
}

/** A sent sheet as the project file the app opens. */
const serveSheet = async (env, sheet) => {
  const db = env.DB
  const id = sheet.id
  const headers = { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' }
  if (!sheet.ejercicio) {
    // Sent with its own PDF: the project file, as the pupil sent it.
    const whole = await stream(env, 'clases', sheet.almacen, 's' + id)
    return whole ? new Response(whole, { headers: { ...headers, 'Content-Length': String(sheet.bytes) } }) : failed(404, 'No se encuentra el archivo de esta lámina.')
  }
  // On an exercise: the strokes the pupil sent, then the exercise's PDF.
  const exercise = await db.prepare('SELECT bytes, almacen, origen FROM ejercicios_clase WHERE id = ?1').bind(sheet.ejercicio).first()
  const strokes = await read(env, 'clases', sheet.almacen, 's' + id)
  if (exercise?.origen && strokes) {
    const sheetPdf = await librarySheet(exercise.origen)
    if (!sheetPdf) return failed(502, 'No se ha podido traer la ficha de su web. Prueba en un rato.')
    const out = new Uint8Array(strokes.length + sheetPdf.length)
    out.set(strokes)
    out.set(sheetPdf, strokes.length)
    return new Response(out, { headers })
  }
  const pdf = exercise && strokes ? await stream(env, 'clases', exercise.almacen, 'e' + sheet.ejercicio, strokes) : null
  return pdf ? new Response(pdf, { headers: { ...headers, 'Content-Length': String(strokes.length + exercise.bytes) } }) : failed(404, 'No se encuentra el archivo de esta lámina.')
}

/** Every class, for the creator's panel: to give a teacher who lost their code their class back. */
export const allClasses = async (db) => {
  await tables(db)
  return (
    await db
      .prepare(
        'SELECT c.id, c.nombre, c.profesor, c.alumnos, c.creada, c.usada, c.bytes, (SELECT COUNT(*) FROM ejercicios_clase e WHERE e.clase = c.id) AS ejercicios, (SELECT COUNT(*) FROM entregas_clase s WHERE s.clase = c.id) AS entregas, (SELECT COUNT(DISTINCT clave) FROM entregas_clase s WHERE s.clase = c.id) AS alumnos_enviaron FROM clases c ORDER BY c.usada DESC LIMIT 500',
      )
      .all()
  ).results
}

export const IDLE_DAYS_CLASSES = IDLE_DAYS

/** A code as it is shown: in groups of three (pupils) or four (teacher), easier to copy by hand. */
export const showCode = (value) => String(value).match(value.length > 8 ? /.{1,4}/g : /.{1,3}/g)?.join('-') ?? value
