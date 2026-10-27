import { fetchSheet, originalOf } from './ejercicios.js'
import { addressOf } from './limites.js'
import { DEVICE, ORIGIN, PRINT, tables } from './registro.js'
import { allClasses, IDLE_DAYS_CLASSES, showCode } from './clases.js'
import { allUsage, stream } from './almacen.js'

/**
 * The creator's panel, at /panelcreador: the sheets people who accepted have worked on, what
 * they do in the app and which exercises they open. It is behind the password kept in the
 * PANEL_CLAVE secret of the worker; entering it leaves a signed cookie for 30 days.
 *
 *   GET  /panelcreador                      the panel, or the way in
 *   POST /panelcreador/entrar               { clave }
 *   GET  /panelcreador/salir
 *   GET  /panelcreador/archivo/<d>/<f>      the original PDF of a sheet
 *   GET  /panelcreador/proyecto/<d>/<f>     the sheet with its strokes, as a project the app opens
 */

const COOKIE = 'panel'
const DAYS = 30
const MAX_TRIES = 5
const LOCK_MINUTES = 15
const encoder = new TextEncoder()

const hmac = async (secret, message) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Equal strings, compared in a time that does not tell how much of them matched. */
const same = (a, b) => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const signedIn = async (request, secret) => {
  const cookie = (request.headers.get('Cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))
  const [expires, signature] = (cookie?.slice(COOKIE.length + 1) ?? '').split('.')
  if (!expires || !signature || Number(expires) < Date.now()) return false
  return same(signature, await hmac(secret, `${COOKIE}:${expires}`))
}

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const html = (body, status = 200, headers = {}) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Panel del creador · Lámina</title><style>${STYLE}</style></head><body>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', ...headers } },
  )

const STYLE = `
:root{--accent:#2563eb;--soft:#eef3fe;--ink:#1f2329;--muted:#6b7280;--line:#eceef1}
*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:var(--ink);font:14px/1.45 Inter,system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 48px}
header{display:flex;align-items:center;gap:12px;margin-bottom:20px}h1{font-size:22px;margin:0;letter-spacing:-.02em}
header a{margin-left:18px;color:var(--muted);text-decoration:none;font-size:13px}header a:first-of-type{margin-left:auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px}
.card,section{background:#fff;border-radius:16px;box-shadow:0 4px 18px rgba(15,23,42,.06)}
.card{padding:14px 16px}.card b{display:block;font-size:26px;letter-spacing:-.02em}.card span{color:var(--muted);font-size:12.5px}
section{padding:16px;margin-bottom:16px;overflow-x:auto}h2{font-size:15px;margin:0 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:var(--muted);font-weight:500;font-size:12px;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.name{font-weight:500;max-width:320px;word-break:break-word}.muted{color:var(--muted)}.num{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;border-radius:999px;padding:1px 8px;background:var(--soft);color:var(--accent);font-size:12px;font-weight:500}
a.btn{display:inline-block;border-radius:8px;padding:3px 9px;background:var(--soft);color:var(--accent);text-decoration:none;font-size:12.5px;font-weight:500;white-space:nowrap;margin:0 4px 4px 0}
a.btn:hover{background:#dbe6fd}code{font-size:12px;color:var(--muted)}
.login{max-width:340px;margin:16vh auto;background:#fff;border-radius:20px;padding:24px;box-shadow:0 10px 36px rgba(15,23,42,.1)}
.login input{width:100%;height:42px;border-radius:12px;border:0;background:#f1f2f4;padding:0 12px;font:inherit;margin:12px 0}
.login button{width:100%;height:42px;border:0;border-radius:12px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
code.key{font-size:12.5px;color:var(--ink);user-select:all;letter-spacing:.04em;white-space:nowrap}
.error{color:#dc2626;font-size:13px}.empty{color:var(--muted);padding:8px 0}
`

const FAILED = {
  wrong: [401, 'Contraseña incorrecta.'],
  locked: [429, `Demasiados intentos fallidos. Vuelve a probar dentro de ${LOCK_MINUTES} minutos.`],
}

const loginPage = (failed) =>
  html(
    `<form class="login" method="post" action="/panelcreador/entrar"><h1>Panel del creador</h1>
<p class="muted">Solo para el autor de Lámina.</p>
<input type="password" name="clave" placeholder="Contraseña" autocomplete="current-password" autofocus required>
${failed ? `<p class="error">${FAILED[failed][1]}</p>` : ''}<button>Entrar</button></form>`,
    failed ? FAILED[failed][0] : 200,
  )

/**
 * Failed passwords, by address: after MAX_TRIES in LOCK_MINUTES that address cannot try again
 * until they are old, so the password cannot be guessed by trying many.
 */
const tries = async (db, ip) => {
  await db.prepare('CREATE TABLE IF NOT EXISTS intentos (ip TEXT NOT NULL, fecha INTEGER NOT NULL)').run()
  const since = Date.now() - LOCK_MINUTES * 60 * 1000
  return (await db.prepare('SELECT COUNT(*) AS n FROM intentos WHERE ip = ?1 AND fecha > ?2').bind(ip, since).first())?.n ?? 0
}
const noteFailure = (db, ip) =>
  db.batch([
    db.prepare('DELETE FROM intentos WHERE fecha < ?1').bind(Date.now() - LOCK_MINUTES * 60 * 1000),
    db.prepare('INSERT INTO intentos (ip, fecha) VALUES (?1, ?2)').bind(ip, Date.now()),
  ])

const when = (ms) =>
  ms ? new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)) : '—'

const OPENED = { pdf: 'PDF', imagen: 'Imagen', blanco: 'Hoja en blanco', proyecto: 'Proyecto', ejercicio: 'Ejercicio' }

/** An event of the activity, said in a few words. */
const describe = (type, detail) => {
  let x = {}
  try {
    x = JSON.parse(detail ?? '{}') ?? {}
  } catch {
    /* no detail */
  }
  if (type === 'abrir') return `Abre ${OPENED[x.tipo] ?? 'un archivo'}${x.nombre ? ` · ${escape(x.nombre)}` : ''}${x.paginas ? ` · ${x.paginas} pág.` : ''}`
  if (type === 'exportar') return `Exporta a ${escape(String(x.formato ?? '').toUpperCase() || 'archivo')}${x.nombre ? ` · ${escape(x.nombre)}` : ''}`
  if (type === 'guardar') return `Guarda el proyecto${x.nombre ? ` · ${escape(x.nombre)}` : ''}`
  if (type === 'aceptar') return 'Acepta enviar sus láminas'
  return escape(type)
}

const device = (d) => `<code title="${escape(d)}">${escape(d.slice(0, 6))}</code>`

const panelPage = async (env) => {
  if (!env.DB) {
    return html(`<main><header><h1>Panel del creador</h1><a href="/panelcreador/salir">Salir</a></header>
<section><p>Falta conectar la base de datos (D1) en <code>wrangler.jsonc</code>. Hasta entonces no se guarda nada.</p></section></main>`)
  }
  const db = env.DB
  await tables(db)
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const [totals, week, sheets, exercises, activity] = await db.batch([
    db.prepare(
      "SELECT (SELECT COUNT(DISTINCT dispositivo) FROM eventos) AS dispositivos, (SELECT COUNT(*) FROM laminas) AS laminas, (SELECT COUNT(*) FROM eventos WHERE tipo = 'exportar') AS exportaciones, (SELECT COUNT(*) FROM eventos WHERE tipo = 'abrir') AS aperturas",
    ),
    db.prepare('SELECT COUNT(DISTINCT dispositivo) AS activos, COUNT(*) AS acciones FROM eventos WHERE fecha > ?1').bind(now - 7 * day),
    db.prepare(
      'SELECT l.dispositivo, l.huella, l.nombre, l.paginas, l.trazos, l.origen, l.actualizada, l.exportada, (a.huella IS NOT NULL OR g.huella IS NOT NULL) AS guardado FROM laminas l LEFT JOIN archivos a ON a.dispositivo = l.dispositivo AND a.huella = l.huella LEFT JOIN archivos_en g ON g.dispositivo = l.dispositivo AND g.huella = l.huella ORDER BY l.actualizada DESC LIMIT 300',
    ),
    db.prepare(
      "SELECT json_extract(detalle, '$.nombre') AS nombre, COUNT(*) AS veces, COUNT(DISTINCT dispositivo) AS personas FROM eventos WHERE tipo = 'abrir' AND json_extract(detalle, '$.tipo') = 'ejercicio' AND fecha > ?1 GROUP BY nombre ORDER BY veces DESC LIMIT 50",
    ).bind(now - 30 * day),
    db.prepare('SELECT * FROM eventos ORDER BY fecha DESC LIMIT 150'),
  ])
  const t = totals.results[0] ?? {}
  const w = week.results[0] ?? {}

  const sheetRows = sheets.results
    .map((s) => {
      const at = `${encodeURIComponent(s.dispositivo)}/${encodeURIComponent(s.huella)}`
      // Big files people opened are not kept: of those there is the name and the strokes, not the sheet.
      const openable = s.guardado || s.origen
      return `<tr><td class="name">${escape(s.nombre ?? 'lamina.pdf')}${s.origen ? ' <span class="tag">Biblioteca</span>' : ''}</td><td class="num">${s.paginas ?? '—'}</td><td class="num">${s.trazos ?? 0}</td>
<td>${s.exportada ? `<span class="tag">${s.exportada} ${s.exportada === 1 ? 'vez' : 'veces'}</span>` : '<span class="muted">No</span>'}</td>
<td>${device(s.dispositivo)}</td><td class="muted">${when(s.actualizada)}</td>
<td>${
        openable
          ? `<a class="btn" href="/?ver=${at}" target="_blank" rel="noopener">Abrir en la mesa</a><a class="btn" href="/panelcreador/archivo/${at}" target="_blank" rel="noopener">PDF original</a>`
          : '<span class="muted" title="No había sitio para guardar el archivo">Archivo no guardado</span>'
      }</td></tr>`
    })
    .join('')

  const exerciseRows = exercises.results
    .map((x) => `<tr><td class="name">${escape(x.nombre ?? '—')}</td><td class="num">${x.veces}</td><td class="num">${x.personas}</td></tr>`)
    .join('')

  const activityRows = activity.results
    .map((e) => `<tr><td class="muted">${when(e.fecha)}</td><td>${device(e.dispositivo)}</td><td>${describe(e.tipo, e.detalle)}</td></tr>`)
    .join('')

  const mb = (bytes) => `${((bytes ?? 0) / 1048576).toFixed(1).replace('.', ',')} MB`
  const classRows = (await allClasses(db))
    .map(
      (c) =>
        `<tr><td class="name">${escape(c.nombre)}</td><td><code class="key">${escape(showCode(c.profesor))}</code></td><td><code class="key">${escape(showCode(c.alumnos))}</code></td>
<td class="num">${c.ejercicios}</td><td class="num">${c.entregas}</td><td class="num">${c.alumnos_enviaron}</td><td class="num">${mb(c.bytes)}</td><td class="muted">${when(c.creada)}</td><td class="muted">${when(c.usada)}</td></tr>`,
    )
    .join('')

  const storeRows = (await allUsage(env))
    .map((u) => `<tr><td>${u.kind === 'clases' ? 'Clases' : 'Archivos de láminas'} ${u.index}</td><td class="num">${mb(u.bytes)}</td><td class="num">${mb(u.room)}</td><td class="num">${Math.round((100 * u.bytes) / u.room)} %</td></tr>`)
    .join('')

  const card = (value, label) => `<div class="card"><b>${value ?? 0}</b><span>${label}</span></div>`
  const table = (head, rows, empty) => (rows ? `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>` : `<p class="empty">${empty}</p>`)

  // The creator's own browser never sends anything: opening someone's sheet here must not send it back.
  return html(`<script>try{localStorage.setItem('lamina:creador','1')}catch(e){}</script>
<main><header><h1>Panel del creador</h1><a href="/">Ir a Lámina</a><a href="/panelcreador/salir">Salir</a></header>
<div class="cards">${card(t.dispositivos, 'personas que aceptaron')}${card(w.activos, 'activas esta semana')}${card(t.laminas, 'láminas recibidas')}${card(t.aperturas, 'archivos abiertos')}${card(t.exportaciones, 'exportaciones')}${card(w.acciones, 'acciones esta semana')}</div>
<section><h2>Clases</h2>${table('<th>Clase</th><th>Código de profesor</th><th>Código de alumnos</th><th class="num">Ejercicios</th><th class="num">Láminas enviadas</th><th class="num">Alumnos que enviaron</th><th class="num">Espacio</th><th>Creada</th><th>Último uso</th>', classRows, 'Todavía no se ha creado ninguna clase.')}
<p class="muted">Si un profesor pierde su código, está aquí. Las clases que nadie abre en ${IDLE_DAYS_CLASSES} días se borran solas.</p></section>
<section><h2>Almacenamiento</h2>${table('<th>Base de datos</th><th class="num">Usado</th><th class="num">Capacidad</th><th class="num">Lleno</th>', storeRows, 'Las bases de datos de archivos no están conectadas.')}
<p class="muted">Los archivos grandes se reparten entre estas bases de datos: cuando una se llena, se usa la siguiente.</p></section>
<section><h2>Láminas</h2>${table('<th>Archivo</th><th class="num">Págs.</th><th class="num">Trazos</th><th>Exportada</th><th>Persona</th><th>Última modificación</th><th></th>', sheetRows, 'Todavía no ha llegado ninguna lámina.')}</section>
<section><h2>Ejercicios más abiertos · últimos 30 días</h2>${table('<th>Ficha</th><th class="num">Veces</th><th class="num">Personas</th>', exerciseRows, 'Nadie ha abierto todavía un ejercicio de la biblioteca.')}</section>
<section><h2>Actividad reciente</h2>${table('<th>Cuándo</th><th>Persona</th><th>Qué</th>', activityRows, 'Sin actividad todavía.')}</section>
<p class="muted">Cada persona es un dispositivo, identificado por un código al azar. Solo llega lo de quien aceptó enviar sus láminas.</p></main>`)
}

const MAGIC = encoder.encode('LAMINA1\n')

const join = (head, pdf) => {
  if (!head) return pdf
  const out = new Uint8Array(head.length + pdf.length)
  out.set(head)
  out.set(pdf, head.length)
  return out
}

/**
 * The original of a sheet, after `head` if given: from the file databases (read piece by piece, so
 * big ones never sit whole in memory), from the first small ones kept in DB, or brought again from
 * the library it came from.
 */
const original = async (env, d, f, head) => {
  const db = env.DB
  const sheet = await db.prepare('SELECT nombre, origen, dibujo FROM laminas WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first()
  if (!sheet) return null
  const big = await db.prepare('SELECT almacen, bytes FROM archivos_en WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first()
  const piece = big && (await stream(env, 'archivos', big.almacen, `${d}/${f}`, head))
  if (piece) return { sheet, body: piece, length: big.bytes + (head?.length ?? 0) }
  const kept = await db.prepare('SELECT datos FROM archivos WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first()
  let pdf = kept?.datos ? new Uint8Array(kept.datos) : null
  if (!pdf && sheet.origen && ORIGIN.test(sheet.origen)) {
    const address = originalOf(sheet.origen.slice('/ejercicios/'.length))
    const fetched = address ? await fetchSheet(address) : null
    pdf = fetched ? new Uint8Array(await fetched.arrayBuffer()) : null
  }
  if (!pdf) return null
  const body = join(head, pdf)
  return { sheet, body, length: body.length }
}

/** The project header of a sheet: its strokes, before the PDF (see src/utils/project.ts). */
const projectHead = async (db, d, f) => {
  const sheet = await db.prepare('SELECT nombre, dibujo FROM laminas WHERE dispositivo = ?1 AND huella = ?2').bind(d, f).first()
  let saved = { shapes: [], page: 0 }
  try {
    saved = JSON.parse(sheet?.dibujo ?? 'null') ?? saved
  } catch {
    /* no strokes kept */
  }
  const header = encoder.encode(JSON.stringify({ version: 1, name: sheet?.nombre ?? 'lamina.pdf', shapes: saved.shapes ?? [], page: saved.page ?? 0 }))
  const head = new Uint8Array(MAGIC.length + 4 + header.length)
  head.set(MAGIC)
  new DataView(head.buffer).setUint32(MAGIC.length, header.length)
  head.set(header, MAGIC.length + 4)
  return head
}

export const panel = async (request, env) => {
  const secret = env.PANEL_CLAVE
  if (!secret) return html('<main><section><h1>Panel del creador</h1><p>Falta poner la contraseña: crea el secreto <code>PANEL_CLAVE</code> en el worker de Cloudflare.</p></section></main>', 503)
  const { pathname } = new URL(request.url)
  const rest = pathname.replace(/^\/panelcreador\/?/, '')

  if (rest === 'entrar' && request.method === 'POST') {
    const ip = addressOf(request)
    if (env.DB && (await tries(env.DB, ip)) >= MAX_TRIES) return loginPage('locked')
    let given = ''
    try {
      given = String((await request.formData()).get('clave') ?? '')
    } catch {
      /* not a form */
    }
    // Both sides go through the same hash, so the comparison takes the same time whatever was typed.
    if (!same(await hmac(secret, `clave:${given}`), await hmac(secret, `clave:${secret}`))) {
      if (env.DB) await noteFailure(env.DB, ip)
      await new Promise((r) => setTimeout(r, 800))
      return loginPage('wrong')
    }
    if (env.DB) await env.DB.prepare('DELETE FROM intentos WHERE ip = ?1').bind(ip).run()
    const expires = Date.now() + DAYS * 24 * 60 * 60 * 1000
    const value = `${expires}.${await hmac(secret, `${COOKIE}:${expires}`)}`
    return new Response(null, {
      status: 303,
      headers: { Location: '/panelcreador', 'Set-Cookie': `${COOKIE}=${value}; Path=/panelcreador; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict` },
    })
  }
  if (rest === 'salir') {
    return new Response(null, { status: 303, headers: { Location: '/panelcreador', 'Set-Cookie': `${COOKIE}=; Path=/panelcreador; Max-Age=0; HttpOnly; Secure; SameSite=Strict` } })
  }
  if (!(await signedIn(request, secret))) return rest ? new Response('No autorizado.', { status: 401 }) : loginPage(false)
  if (!rest) return panelPage(env)

  const [kind, d, f] = rest.split('/').map(decodeURIComponent)
  if (!env.DB || !DEVICE.test(d ?? '') || !PRINT.test(f ?? '')) return new Response('No encontrado.', { status: 404 })
  await tables(env.DB)
  if (kind === 'archivo') {
    const found = await original(env, d, f)
    if (!found) return new Response('Este archivo no se guardó.', { status: 404 })
    const name = (found.sheet.nombre ?? 'lamina.pdf').replace(/[^\w .()-]/g, '_')
    return new Response(found.body, { headers: { 'Content-Length': String(found.length), 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'no-store' } })
  }
  if (kind === 'proyecto') {
    const found = await original(env, d, f, await projectHead(env.DB, d, f))
    return found
      ? new Response(found.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(found.length), 'Cache-Control': 'no-store' } })
      : new Response('No encontrado.', { status: 404 })
  }
  return new Response('No encontrado.', { status: 404 })
}
