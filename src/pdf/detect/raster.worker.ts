import { darkMask, detectRasterLines, refineCircle, type DarkMask, type RasterInput } from './raster'

type Request =
  | ({ type: 'lines'; id: number } & RasterInput)
  | { type: 'refine'; id: number; circles: [number, number, number][] }

/** The last page's ink, kept so circles found from chords can be refined on the real pixels. */
let mask: DarkMask | null = null

self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data
  if (req.type === 'lines') {
    const { id, type: _type, ...input } = req
    mask = darkMask(input)
    self.postMessage({ id, segments: detectRasterLines(input) })
    return
  }
  const circles = mask ? req.circles.map(([x, y, r]) => refineCircle(mask!, x, y, r)) : req.circles
  self.postMessage({ id: req.id, circles })
}
