/**
 * What the app sends, only for people who accepted it in the consent notice: what they do in the
 * app (open, export, save) and copies of the sheets they work on, their strokes and, when it is
 * small, the original file. Everything is kept per device, under a random id the app makes, so
 * that a device can have all of its data deleted at once.
 *
 *   POST /registro/evento    { d, t, f?, x? }                                 something done in the app
 *   PUT  /registro/archivo?d=&f=&n=   (the PDF)                                 a small original, once
 *   POST /registro/dibujo    { d, f, n, paginas, pagina, dibujo, origen? }    the strokes, as they are now
 *   POST /registro/borrar    { d }                                            forget everything of a device
 *
 * All of it lives in the D1 database DB (free plan: 500 MB). Originals are kept only while small
 * and while they all fit in FILES_BUDGET, and strokes while they fit in DRAWINGS_BUDGET, so that
 * nobody sending junk can fill the database; exercises of the library are not kept at all, their
 * address (origen) is enough to open them again. Only the latest MAX_EVENTS events are kept.
 */
import { slowDown, tooMany } from './limites.js'


export const DEVICE = /^[a-z0-9-]{8,40}$/
export const PRINT = /^[a-f0-9]{16,64}$/
const EVENT = /^[a-z-]{2,20}$/
/** Address of a sheet of the library, as the app opens it. */
export const ORIGIN = /^\/ejercicios\/[A-Za-z0-9_\-/.%+]+\.pdf$/
/** Largest original kept (the app does not send bigger ones). */
export const MAX_FILE = 256 * 1024
/** Room for all the originals together. */
const FILES_BUDGET = 150 * 1024 * 1024
/** Room for all the strokes together. */
const DRAWINGS_BUDGET = 200 * 1024 * 1024
const MAX_DRAWING = 900 * 1024
const MAX_EVENTS = 300000
/** Requests each address may make in a minute, by action: well above what the app sends. */
const PER_MINUTE = { evento: 60, dibujo: 20, archivo: 10, borrar: 10 }

let ready = false
/** The tables, made the first time they are needed. */
export const tables = async (db) => {
  if (ready) return
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha INTEGER NOT NULL, dispositivo TEXT NOT NULL, tipo TEXT NOT NULL, huella TEXT, detalle TEXT)',
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS eventos_fecha ON eventos (fecha)'),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS laminas (dispositivo TEXT NOT NULL, huella TEXT NOT NULL, nombre TEXT, paginas INTEGER, trazos INTEGER, dibujo TEXT, origen TEXT, creada INTEGER, actualizada INTEGER, exportada INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dispositivo, huella))',
    ),
    db.prepare('CREATE TABLE IF NOT EXISTS archivos (dispositivo TEXT NOT NULL, huella TEXT NOT NULL, datos BLOB NOT NULL, PRIMARY KEY (dispositivo, huella))'),
    // Bytes kept of originals and of strokes, so the budgets are checked without reading every row.
    db.prepare('CREATE TABLE IF NOT EXISTS uso (clave TEXT PRIMARY KEY, bytes INTEGER NOT NULL)'),
  ])
  const counted = (await db.prepare('SELECT clave FROM uso').all()).results.map((r) => r.clave)
  // Counted once from the rows themselves, the first time.
  if (!counted.includes('archivos')) await db.prepare("INSERT OR IGNORE INTO uso (clave, bytes) SELECT 'archivos', COALESCE(SUM(LENGTH(datos)), 0) FROM archivos").run()
  if (!counted.includes('dibujos')) await db.prepare("INSERT OR IGNORE INTO uso (clave, bytes) SELECT 'dibujos', COALESCE(SUM(LENGTH(dibujo)), 0) FROM laminas").run()
  ready = true
}

const usage = async (db, key) => (await db.prepare('SELECT bytes FROM uso WHERE clave = ?1').bind(key).first())?.bytes ?? 0
const addUsage = (db, key, delta) => db.prepare('UPDATE uso SET bytes = MAX(0, bytes + ?2) WHERE clave = ?1').bind(key, delta)

const answer = (status, body = { ok: status < 300 }) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : null)
const whole = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(1e6, Math.round(value))) : null)

const readJson = async (request, max) => {
  const body = await request.text()
  if (body.length > max) throw new Error('too large')
  return JSON.parse(body)
}

export const registro = async (request, env, action) => {
  if (!env.DB) return answer(503, { ok: false })
  if (tooMany(request, 'registro-' + action, PER_MINUTE[action] ?? 10)) return slowDown()
  const db = env.DB
  await tables(db)
  const now = Date.now()

  if (action === 'archivo' && request.method === 'PUT') {
    const url = new URL(request.url)
    const d = url.searchParams.get('d') ?? ''
    const f = url.searchParams.get('f') ?? ''
    if (!DEVICE.test(d) || !PRINT.test(f)) return answer(400)
    if (Number(request.headers.get('content-length') ?? 0) > MAX_FILE) return answer(413)
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.length > MAX_FILE) return answer(413)
    if (!new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-')) return answer(400)
    const before = (await db.prepare('SELECT LENGTH(datos) AS antes FROM archivos WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first())?.antes ?? 0
    // Out of room the sheet is still listed, with its strokes; only its original is not kept.
    if ((await usage(db, 'archivos')) - before + bytes.length > FILES_BUDGET) return answer(507, { ok: false })
    const name = text(url.searchParams.get('n'), 200) ?? 'lamina.pdf'
    await db.batch([
      db.prepare('INSERT OR REPLACE INTO archivos (dispositivo, huella, datos) VALUES (?1, ?2, ?3)').bind(d, f, bytes),
      addUsage(db, 'archivos', bytes.length - before),
      db
        .prepare('INSERT INTO laminas (dispositivo, huella, nombre, creada, actualizada) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT (dispositivo, huella) DO UPDATE SET nombre = ?3')
        .bind(d, f, name, now),
    ])
    return answer(200)
  }
  if (request.method !== 'POST') return answer(405)

  let body
  try {
    body = await readJson(request, action === 'dibujo' ? MAX_DRAWING : 16 * 1024)
  } catch {
    return answer(413)
  }
  const d = String(body?.d ?? '')
  if (!DEVICE.test(d)) return answer(400)

  if (action === 'evento') {
    const t = String(body.t ?? '')
    const f = body.f == null ? null : String(body.f)
    if (!EVENT.test(t) || (f !== null && !PRINT.test(f))) return answer(400)
    const detail = body.x == null ? null : JSON.stringify(body.x).slice(0, 2000)
    const writes = [db.prepare('INSERT INTO eventos (fecha, dispositivo, tipo, huella, detalle) VALUES (?1, ?2, ?3, ?4, ?5)').bind(now, d, t, f, detail)]
    if (f && t === 'exportar') writes.push(db.prepare('UPDATE laminas SET exportada = exportada + 1 WHERE dispositivo = ?1 AND huella = ?2').bind(d, f))
    // Now and then the oldest events beyond the last MAX_EVENTS go.
    if (Math.random() < 0.01) writes.push(db.prepare('DELETE FROM eventos WHERE id <= (SELECT MAX(id) FROM eventos) - ?1').bind(MAX_EVENTS))
    await db.batch(writes)
    return answer(200)
  }

  if (action === 'dibujo') {
    const f = String(body.f ?? '')
    if (!PRINT.test(f) || !Array.isArray(body.dibujo)) return answer(400)
    const name = text(body.n, 200) ?? 'lamina.pdf'
    const origin = typeof body.origen === 'string' && ORIGIN.test(body.origen) ? body.origen : null
    const drawing = JSON.stringify({ shapes: body.dibujo, page: whole(body.pagina) ?? 0 })
    const before = (await db.prepare('SELECT LENGTH(dibujo) AS antes FROM laminas WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first())?.antes ?? 0
    if ((await usage(db, 'dibujos')) - before + drawing.length > DRAWINGS_BUDGET) return answer(507, { ok: false })
    await db.batch([
      db
        .prepare(
          'INSERT INTO laminas (dispositivo, huella, nombre, paginas, trazos, dibujo, origen, creada, actualizada) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) ON CONFLICT (dispositivo, huella) DO UPDATE SET nombre = ?3, paginas = ?4, trazos = ?5, dibujo = ?6, origen = COALESCE(?7, origen), actualizada = ?8',
        )
        .bind(d, f, name, whole(body.paginas), body.dibujo.length, drawing, origin, now),
      addUsage(db, 'dibujos', drawing.length - before),
    ])
    return answer(200)
  }

  if (action === 'borrar') {
    const held = await db
      .prepare('SELECT (SELECT COALESCE(SUM(LENGTH(dibujo)), 0) FROM laminas WHERE dispositivo = ?1) AS dibujos, (SELECT COALESCE(SUM(LENGTH(datos)), 0) FROM archivos WHERE dispositivo = ?1) AS archivos')
      .bind(d)
      .first()
    await db.batch([
      addUsage(db, 'dibujos', -(held?.dibujos ?? 0)),
      addUsage(db, 'archivos', -(held?.archivos ?? 0)),
      db.prepare('DELETE FROM eventos WHERE dispositivo = ?1').bind(d),
      db.prepare('DELETE FROM laminas WHERE dispositivo = ?1').bind(d),
      db.prepare('DELETE FROM archivos WHERE dispositivo = ?1').bind(d),
    ])
    return answer(200)
  }
  return answer(404)
}
