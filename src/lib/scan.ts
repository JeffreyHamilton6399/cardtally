/**
 * Reading a card out of an image, entirely inside the tab.
 *
 * Two passes run over every frame. The barcode pass is cheap and exact, so it
 * goes first and short-circuits the rest when it succeeds. The OCR pass is
 * expensive - a WebAssembly build of Tesseract, a second or two per frame - and
 * runs on a preprocessed copy of the image rather than the original, because
 * gift cards are the worst case for OCR: small tight digits printed on foil,
 * gloss and holograms, photographed at an angle under a ceiling light.
 *
 * Nothing here uploads anything. The Tesseract worker, its wasm core and the
 * English model are served from this origin (see scripts/vendor-tesseract.mjs),
 * so a scan works with the network off and there is no third party to leak to.
 */

import { createWorker, type Worker } from "tesseract.js"

const TESSERACT_ASSETS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/core",
  langPath: "/tesseract/lang",
}

export type ScanResult = {
  text: string
  barcodes: string[]
  /** Milliseconds the whole scan took, shown in the debug line. */
  ms: number
}

/* -------------------------------------------------------------------------- */
/* Barcodes                                                                   */
/* -------------------------------------------------------------------------- */

type DetectedBarcode = { rawValue: string }
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike
  getSupportedFormats?(): Promise<string[]>
}

/** The formats gift cards actually use, in rough order of how often. */
const BARCODE_FORMATS = ["code_128", "code_39", "pdf417", "qr_code", "itf", "codabar", "ean_13", "upc_a"]

function barcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  return ctor ?? null
}

export function hasNativeBarcodeDetector(): boolean {
  return barcodeDetector() !== null
}

async function readBarcodesNative(canvas: HTMLCanvasElement): Promise<string[]> {
  const Ctor = barcodeDetector()
  if (!Ctor) return []
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? BARCODE_FORMATS
    const formats = BARCODE_FORMATS.filter((f) => supported.includes(f))
    const detector = new Ctor(formats.length ? { formats } : undefined)
    const found = await detector.detect(canvas)
    return found.map((b) => b.rawValue).filter(Boolean)
  } catch {
    // A detector that throws is treated exactly like one that finds nothing:
    // the OCR pass is still ahead and can carry the scan on its own.
    return []
  }
}

/**
 * ZXing, loaded only when the browser has no BarcodeDetector of its own.
 *
 * Safari and Firefox are the ones that need this. The import is dynamic so the
 * ~200kB never lands on Chrome and Android, where the native detector is both
 * present and faster.
 */
async function readBarcodesZXing(canvas: HTMLCanvasElement): Promise<string[]> {
  try {
    const { BrowserMultiFormatReader } = await import("@zxing/browser")
    const reader = new BrowserMultiFormatReader()
    const result = reader.decodeFromCanvas(canvas)
    const text = result?.getText?.()
    return text ? [text] : []
  } catch {
    return []
  }
}

export async function readBarcodes(canvas: HTMLCanvasElement): Promise<string[]> {
  const native = await readBarcodesNative(canvas)
  if (native.length) return native
  return readBarcodesZXing(canvas)
}

/* -------------------------------------------------------------------------- */
/* Image preparation                                                          */
/* -------------------------------------------------------------------------- */

/** Draw any image source onto a canvas, scaled so the long edge is `maxEdge`. */
export function toCanvas(source: CanvasImageSource, width: number, height: number, maxEdge = 1600): HTMLCanvasElement {
  const scale = Math.min(maxEdge / Math.max(width, height), 4)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext("2d")
  if (ctx) {
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  }
  return canvas
}

/**
 * Grey, stretch, sharpen.
 *
 * Tesseract wants dark text on a light ground and gets neither from a photo of
 * a gift card. Three cheap steps fix most of it: collapse to luminance so a
 * coloured foil ground stops competing with the ink, stretch the histogram
 * between its own 5th and 95th percentiles so a washed-out photo regains its
 * black and white, then unsharp-mask to put an edge back on digits that the
 * camera's own noise reduction smeared.
 *
 * Deliberately not binarised. A hard threshold looks cleaner to the eye and
 * reads worse, because it eats thin strokes on embossed numbers - the 8s and 9s
 * lose their crossings and come back as 0s.
 */
export function preprocess(input: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = input.getContext("2d", { willReadFrequently: true })
  if (!ctx) return input

  const { width, height } = input
  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data

  const grey = new Uint8ClampedArray(width * height)
  const histogram = new Uint32Array(256)

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    // Rec. 601 luma. Cheaper than a colour-space conversion and close enough.
    const value = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    const v = value < 0 ? 0 : value > 255 ? 255 : value | 0
    grey[p] = v
    histogram[v]++
  }

  const total = width * height

  // Clip half a percent off each end, not five.
  //
  // A card is mostly background: the ink can easily be under three percent of
  // the pixels. Clipping five percent then puts both the low and the high mark
  // inside the background peak, the span collapses to nothing, and the stretch
  // drives the entire image to black - the text does not survive and OCR
  // returns an empty string. Half a percent is enough to ignore a hot specular
  // highlight or a dead pixel without swallowing the writing.
  const lowCut = total * 0.005
  const highCut = total * 0.995
  let low = 0
  let high = 255
  let running = 0
  for (let v = 0; v < 256; v++) {
    running += histogram[v]
    if (running >= lowCut) {
      low = v
      break
    }
  }
  running = 0
  for (let v = 0; v < 256; v++) {
    running += histogram[v]
    if (running >= highCut) {
      high = v
      break
    }
  }

  // A span this narrow means a blank or near-blank frame. Stretching it would
  // amplify sensor noise into something that looks like text, so leave it be
  // and let the scan come back empty honestly.
  const range = high - low
  const stretched = new Uint8ClampedArray(total)
  if (range < 32) {
    stretched.set(grey)
  } else {
    for (let p = 0; p < total; p++) {
      stretched[p] = ((grey[p] - low) * 255) / range
    }
  }

  // Unsharp mask against a 3x3 box blur.
  const AMOUNT = 0.8
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += stretched[yy * width + xx]
          n++
        }
      }
      const blurred = sum / n
      const sharpened = stretched[p] + (stretched[p] - blurred) * AMOUNT
      const v = sharpened < 0 ? 0 : sharpened > 255 ? 255 : sharpened
      const i = p * 4
      px[i] = px[i + 1] = px[i + 2] = v
      px[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return input
}

/* -------------------------------------------------------------------------- */
/* OCR                                                                        */
/* -------------------------------------------------------------------------- */

let workerPromise: Promise<Worker> | null = null

/**
 * One worker for the life of the tab.
 *
 * Starting a Tesseract worker means compiling the wasm and parsing a 2MB
 * language model, which is most of a second. Scanning is something people do
 * three or four cards in a row, so the worker is created once, kept, and reused
 * for every scan after the first.
 */
function getWorker(onProgress?: (pct: number) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      ...TESSERACT_ASSETS,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onProgress?.(m.progress)
      },
    }).catch((error) => {
      // A failed start must not poison every later attempt.
      workerPromise = null
      throw error
    })
  }
  return workerPromise
}

export async function warmUpOcr(): Promise<void> {
  try {
    await getWorker()
  } catch {
    // Warming is best-effort. A real scan will surface the error properly.
  }
}

export async function terminateOcr(): Promise<void> {
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // Nothing useful to do if a worker refuses to shut down.
  }
}

/**
 * Scan one canvas.
 *
 * The barcode pass reads the untouched canvas, because the preprocessing that
 * helps OCR actively hurts barcode decoding - stretching the histogram on a
 * clean black-on-white symbol only adds ringing at the bar edges.
 */
export async function scanCanvas(canvas: HTMLCanvasElement, onProgress?: (pct: number) => void): Promise<ScanResult> {
  const started = performance.now()
  const barcodes = await readBarcodes(canvas)

  const prepared = preprocess(canvas)
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(prepared)

  return {
    text: data.text ?? "",
    barcodes,
    ms: Math.round(performance.now() - started),
  }
}

/** Scan a file the user dropped, pasted or picked. */
export async function scanFile(file: File, onProgress?: (pct: number) => void): Promise<ScanResult> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = toCanvas(bitmap, bitmap.width, bitmap.height)
    return await scanCanvas(canvas, onProgress)
  } finally {
    bitmap.close()
  }
}

/** Scan the current frame of a running <video>. */
export async function scanVideoFrame(video: HTMLVideoElement, onProgress?: (pct: number) => void): Promise<ScanResult> {
  const canvas = toCanvas(video, video.videoWidth, video.videoHeight)
  return scanCanvas(canvas, onProgress)
}
