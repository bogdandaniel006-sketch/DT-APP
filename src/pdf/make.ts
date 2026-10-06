import type { PDFDocument } from 'pdf-lib'
import { mmToPt } from '../geometry/units'

/**
 * Documents made here. Everything on the desk is a PDF, so a blank sheet or a picture
 * becomes one and then behaves like any opened file: pages, snapping, export, projects.
 * pdf-lib is loaded on demand: it is large and only needed for these and for exporting.
 */

export type SheetFormat = 'a4-portrait' | 'a4-landscape' | 'a3-landscape'

const A4 = { w: mmToPt(210), h: mmToPt(297) }

const SHEET_SIZES: Record<SheetFormat, { w: number; h: number }> = {
  'a4-portrait': A4,
  'a4-landscape': { w: A4.h, h: A4.w },
  'a3-landscape': { w: mmToPt(420), h: mmToPt(297) },
}

/** Largest side, in pixels, a picture keeps when it becomes a sheet. */
const MAX_IMAGE_SIDE = 3600

/**
 * Gives the document an identifier of its own. Without one, two documents that start
 * alike (two blank sheets) would be taken for the same file and share their drawing.
 */
export const stamp = async (doc: PDFDocument) => {
  const { PDFHexString } = await import('pdf-lib')
  const random = crypto.getRandomValues(new Uint8Array(16))
  const id = PDFHexString.of([...random].map((b) => b.toString(16).padStart(2, '0')).join(''))
  doc.context.trailerInfo.ID = doc.context.obj([id, id])
}

export const blankPdf = async (format: SheetFormat): Promise<Uint8Array> => {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const { w, h } = SHEET_SIZES[format]
  doc.addPage([w, h])
  await stamp(doc)
  return doc.save()
}

/** The same document with one more blank page at the end, the size of its last one. */
export const withBlankPage = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pages = doc.getPages()
  const last = pages[pages.length - 1]
  const { width, height } = last ? last.getSize() : { width: A4.w, height: A4.h }
  doc.addPage([width, height])
  return doc.save()
}

/** A picture as a one-page PDF: an A4 sheet turned to the picture's shape, with the picture filling it. */
export const imagePdf = async (image: Blob): Promise<Uint8Array> => {
  const { PDFDocument } = await import('pdf-lib')
  // Drawn through a canvas: any format the browser reads, upright whatever the camera said.
  const bitmap = await createImageBitmap(image)
  const shrink = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * shrink))
  canvas.height = Math.max(1, Math.round(bitmap.height * shrink))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se puede leer la imagen')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Photographs stay photographs; drawings and screenshots keep their sharp edges.
  const photo = image.type === 'image/jpeg'
  const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, photo ? 'image/jpeg' : 'image/png', 0.92))
  if (!encoded) throw new Error('No se puede leer la imagen')
  const data = new Uint8Array(await encoded.arrayBuffer())

  const doc = await PDFDocument.create()
  const picture = photo ? await doc.embedJpg(data) : await doc.embedPng(data)
  const sheet = canvas.width > canvas.height ? SHEET_SIZES['a4-landscape'] : A4
  const fit = Math.min(sheet.w / canvas.width, sheet.h / canvas.height)
  const w = canvas.width * fit
  const h = canvas.height * fit
  const page = doc.addPage([sheet.w, sheet.h])
  page.drawImage(picture, { x: (sheet.w - w) / 2, y: (sheet.h - h) / 2, width: w, height: h })
  await stamp(doc)
  return doc.save()
}
