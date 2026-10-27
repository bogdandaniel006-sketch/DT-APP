/**
 * Hands the sheets of the exercise library to the app, which cannot read them from the
 * browser: their sites do not let other pages read their files, and the main one is only
 * served over http. Only PDFs of the sites listed here can be requested, each fetched from
 * its original when asked for; none is stored. Besides these and the paths below, everything is the app.
 *
 *   /ejercicios/doc/…  /ejercicios/pau/…   the main library (dtecnico.com)
 *   /ejercicios/<id>/…                     the other sites of src/data/exercises.ts
 *   POST /abrir                            a project opened from its web file (see openProject)
 *   /registro/…                            what people who accepted send: activity and sheets (see registro.js)
 *   /clases/…                              classes: exercises put up and sheets sent (see clases.js)
 *   /panelcreador                          the creator's panel (see panel.js)
 */
import { panel } from './panel.js'
import { fetchSheet, originalOf } from './ejercicios.js'
import { registro } from './registro.js'
import { clases } from './clases.js'
import { slowDown, tooMany } from './limites.js'

/** Largest project opened from a web file (its PDF and strokes, as text). */
const MAX_PROJECT = 40 * 1024 * 1024

/**
 * A project saved as a web file sends itself here when it is opened from the file explorer.
 * The answer is the app with the project inside the page, for the app to pick up as it starts.
 * Only base64 text is let through, so nothing sent can become markup.
 */
const openProject = async (request, env) => {
  const home = new URL('/', request.url)
  if (tooMany(request, 'abrir', 20)) return slowDown()
  if (Number(request.headers.get('content-length') ?? 0) > MAX_PROJECT) return new Response('El proyecto es demasiado grande.', { status: 413 })
  let data = ''
  try {
    data = String((await request.formData()).get('data') ?? '').replace(/\s+/g, '')
  } catch {
    /* not a form: nothing to open */
  }
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return Response.redirect(home.href, 303)
  const page = await (await env.ASSETS.fetch(new Request(home))).text()
  const handed = `<script id="lamina-open" type="application/octet-stream">${data}</script>`
  return new Response(page.replace('</head>', () => handed + '</head>'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (request.method === 'POST' && pathname === '/abrir') return openProject(request, env)
    if (pathname.startsWith('/registro/')) return registro(request, env, pathname.slice(10))
    if (pathname.startsWith('/clases/')) return clases(request, env, pathname.slice(8))
    if (pathname === '/panelcreador' || pathname.startsWith('/panelcreador/')) return panel(request, env)
    const original = request.method === 'GET' && pathname.startsWith('/ejercicios/') ? originalOf(pathname.slice(12)) : null
    if (!original) return env.ASSETS.fetch(request)
    if (tooMany(request, 'ejercicios', 60)) return slowDown()

    const sheet = await fetchSheet(original)
    if (!sheet) return new Response('No se ha podido obtener la ficha.', { status: 502 })
    return new Response(sheet.body, {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
    })
  },
}
