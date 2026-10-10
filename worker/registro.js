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
 * and while they all fit in FILES_BUDGET, so they never crowd out the rest; exercises of the
 * library are not kept at all, their address (origen) is enough to open them again.
 */

export const DEVICE = /^[a-z0-9-]{8,40}$/
export const PRINT = /^[a-f0-9]{16,64}$/
const EVENT = /^[a-z-]{2,20}$/
/** Address of a sheet of the library, as the app opens it. */
export const ORIGIN = /^\/ejercicios\/[A-Za-z0-9_\-/.%+]+\.pdf$/
/** Largest original kept (the app does not send bigger ones). */
export const MAX_FILE = 256 * 1024
/** Room for all the originals together. */
const FILES_BUDGET = 200 * 1024 * 1024
const MAX_DRAWING = 900 * 1024

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
  ])
  ready = true
}

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
    const used = (await db.prepare('SELECT COALESCE(SUM(LENGTH(datos)), 0) AS usado FROM archivos').first())?.usado ?? 0
    // Out of room the sheet is still listed, with its strokes; only its original is not kept.
    if (used + bytes.length > FILES_BUDGET) return answer(507, { ok: false })
    const name = text(url.searchParams.get('n'), 200) ?? 'lamina.pdf'
    await db.batch([
      db.prepare('INSERT OR REPLACE INTO archivos (dispositivo, huella, datos) VALUES (?1, ?2, ?3)').bind(d, f, bytes),
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
    await db.batch(writes)
    return answer(200)
  }

  if (action === 'dibujo') {
    const f = String(body.f ?? '')
    if (!PRINT.test(f) || !Array.isArray(body.dibujo)) return answer(400)
    const name = text(body.n, 200) ?? 'lamina.pdf'
    const origin = typeof body.origen === 'string' && ORIGIN.test(body.origen) ? body.origen : null
    const drawing = JSON.stringify({ shapes: body.dibujo, page: whole(body.pagina) ?? 0 })
    await db
      .prepare(
        'INSERT INTO laminas (dispositivo, huella, nombre, paginas, trazos, dibujo, origen, creada, actualizada) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) ON CONFLICT (dispositivo, huella) DO UPDATE SET nombre = ?3, paginas = ?4, trazos = ?5, dibujo = ?6, origen = COALESCE(?7, origen), actualizada = ?8',
      )
      .bind(d, f, name, whole(body.paginas), body.dibujo.length, drawing, origin, now)
      .run()
    return answer(200)
  }

  if (action === 'borrar') {
    await db.batch([
      db.prepare('DELETE FROM eventos WHERE dispositivo = ?1').bind(d),
      db.prepare('DELETE FROM laminas WHERE dispositivo = ?1').bind(d),
      db.prepare('DELETE FROM archivos WHERE dispositivo = ?1').bind(d),
    ])
    return answer(200)
  }
  return answer(404)
}
