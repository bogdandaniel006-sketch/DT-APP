/**
 * What the app sends, only for people who accepted it in the consent notice: what they do in the
 * app (open, export, save) and copies of the sheets they work on, the original file and their
 * strokes. Everything is kept per device, under a random id the app makes, so that a device can
 * have all of its data deleted at once.
 *
 *   POST /registro/evento    { d, t, f?, x? }                       something done in the app
 *   PUT  /registro/archivo?d=&f=&n=   (the PDF)                       the original of a sheet, once
 *   POST /registro/dibujo    { d, f, n, paginas, trazos, dibujo }   the strokes on it, as they are now
 *   POST /registro/borrar    { d }                                  forget everything of a device
 *
 * Sheets live in the R2 bucket LAMINAS, the list of sheets and the activity in the D1 database DB.
 * Without them (not yet connected in wrangler.jsonc) nothing is kept.
 */

export const DEVICE = /^[a-z0-9-]{8,40}$/
export const PRINT = /^[a-f0-9]{16,64}$/
const EVENT = /^[a-z-]{2,20}$/
const MAX_FILE = 40 * 1024 * 1024
const MAX_DRAWING = 4 * 1024 * 1024

export const fileKey = (d, f) => `archivos/${d}/${f}.pdf`
export const drawingKey = (d, f) => `dibujos/${d}/${f}.json`

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
      'CREATE TABLE IF NOT EXISTS laminas (dispositivo TEXT NOT NULL, huella TEXT NOT NULL, nombre TEXT, paginas INTEGER, trazos INTEGER, creada INTEGER, actualizada INTEGER, exportada INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dispositivo, huella))',
    ),
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
  if (!env.DB || !env.LAMINAS) return answer(503, { ok: false })
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
    const name = text(url.searchParams.get('n'), 200) ?? 'lamina.pdf'
    await env.LAMINAS.put(fileKey(d, f), bytes, { httpMetadata: { contentType: 'application/pdf' }, customMetadata: { name } })
    await db
      .prepare('INSERT INTO laminas (dispositivo, huella, nombre, creada, actualizada) VALUES (?1, ?2, ?3, ?4, ?4) ON CONFLICT (dispositivo, huella) DO UPDATE SET nombre = ?3')
      .bind(d, f, name, now)
      .run()
    return answer(200)
  }
  if (request.method !== 'POST') return answer(405)

  let body
  try {
    body = await readJson(request, action === 'dibujo' ? MAX_DRAWING : 16 * 1024)
  } catch {
    return answer(400)
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
    await env.LAMINAS.put(drawingKey(d, f), JSON.stringify({ shapes: body.dibujo, page: whole(body.pagina) ?? 0 }), {
      httpMetadata: { contentType: 'application/json' },
    })
    await db
      .prepare(
        'INSERT INTO laminas (dispositivo, huella, nombre, paginas, trazos, creada, actualizada) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6) ON CONFLICT (dispositivo, huella) DO UPDATE SET nombre = ?3, paginas = ?4, trazos = ?5, actualizada = ?6',
      )
      .bind(d, f, name, whole(body.paginas), body.dibujo.length, now)
      .run()
    return answer(200)
  }

  if (action === 'borrar') {
    for (const prefix of [`archivos/${d}/`, `dibujos/${d}/`]) {
      let cursor
      do {
        const list = await env.LAMINAS.list({ prefix, cursor })
        if (list.objects.length) await env.LAMINAS.delete(list.objects.map((o) => o.key))
        cursor = list.truncated ? list.cursor : undefined
      } while (cursor)
    }
    await db.batch([db.prepare('DELETE FROM eventos WHERE dispositivo = ?1').bind(d), db.prepare('DELETE FROM laminas WHERE dispositivo = ?1').bind(d)])
    return answer(200)
  }
  return answer(404)
}
