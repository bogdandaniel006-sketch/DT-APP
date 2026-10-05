/**
 * Hands the sheets of the exercise library to the app, which cannot read them from the
 * browser: their sites do not let other pages read their files, and the main one is only
 * served over http. Only PDFs of the sites listed here can be requested, each fetched from
 * its original when asked for; nothing is stored. Everything else is the app.
 *
 *   /ejercicios/doc/…  /ejercicios/pau/…   the main library (dtecnico.com)
 *   /ejercicios/<id>/…                     the other sites of src/data/exercises.ts
 */
const MAIN = 'http://dtecnico.com/'
const MAIN_SHEET = /^(?:doc|pau)\/[a-z0-9-]+\.pdf$/

/** Base address of each other source, by the id it has in the data. */
const OTHERS = {
  laslaminas: 'https://www.laslaminas.es/',
  ibiguridt: 'https://ibiguridt.wordpress.com/wp-content/uploads/',
  dibujotecnico: 'https://www.dibujotecnico.com/Ejercicios/',
  educacionplastica: 'https://www.educacionplastica.net/pdfs/',
  dibujoramon: 'https://dibujoramon.wordpress.com/wp-content/uploads/',
  laescuadracreativa: 'https://laescuadracreativa.wordpress.com/wp-content/uploads/',
  educacionplasticayvisual: 'https://educacionplasticayvisual.com/wp-content/uploads/',
  tecnorincon: 'https://tecnorincon.jimdofree.com/app/download/',
  yourtechnologyweb: 'https://www.yourtechnologyweb.com/wp-content/uploads/',
  iesmarenostrum: 'https://www.iesmarenostrum.com/departamentos/tecnologia/',
  iesarzobispolozano: 'https://www.murciaeduca.es/iesarzobispolozano/sitio/upload/',
  cpiasrevoltas: 'https://www.edu.xunta.gal/centros/cpiasrevoltas/system/files/',
  alfredodibujo: 'https://alfredodibujo.wordpress.com/wp-content/uploads/',
  fceia: 'https://www.fceia.unr.edu.ar/dibujo/',
  ocwunican: 'https://ocw.unican.es/pluginfile.php/2058/course/section/1800/',
  agustindelatorre: 'https://agustindelatorre.com/wp-content/uploads/',
  franmdibujotecnico: 'https://blogsaverroes.juntadeandalucia.es/franmdibujotecnico/files/',
  lanubeartistica: 'https://www.lanubeartistica.es/Dibujo_Tecnico_Primero/',
  ecoblogcanarias: 'https://www3.gobiernodecanarias.org/medusa/ecoblog/mmormarf/files/',
  apuntesmareaverde: 'https://www.apuntesmareaverde.org.es/grupos/tec/loe/',
  dibqr: 'https://dibqr.com/wp-content/uploads/',
  dibujotecnicoiyii: 'https://dibujotecnicoiyii.wordpress.com/wp-content/uploads/',
}
/** A plain path to a PDF, as its site spells it (it may be percent-encoded). */
const SHEET = /^[A-Za-z0-9_\-/.%+]+\.pdf$/
/** Anything that could step out of the source's folder: dot segments, doubled or encoded slashes and dots. */
const ESCAPES = /\.\.|\/\/|%2e|%2f|%5c/i

/** Address of the original PDF for a path under /ejercicios/, or null when it is not a sheet. */
const originalOf = (path) => {
  if (MAIN_SHEET.test(path)) return MAIN + path
  const slash = path.indexOf('/')
  if (slash < 1) return null
  const id = path.slice(0, slash)
  const file = path.slice(slash + 1)
  if (!Object.hasOwn(OTHERS, id) || !SHEET.test(file) || ESCAPES.test(file) || file.startsWith('/')) return null
  return OTHERS[id] + file
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    const original = request.method === 'GET' && pathname.startsWith('/ejercicios/') ? originalOf(pathname.slice(12)) : null
    if (!original) return env.ASSETS.fetch(request)

    const sheet = await fetch(original, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Lamina; +https://danidemiguel.aldanidaniel12.workers.dev)' },
      cf: { cacheEverything: true, cacheTtl: 86400 },
    })
    if (!sheet.ok || !(sheet.headers.get('content-type') ?? '').includes('pdf')) {
      return new Response('No se ha podido obtener la ficha.', { status: 502 })
    }
    return new Response(sheet.body, {
      headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400' },
    })
  },
}
