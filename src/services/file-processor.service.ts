import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { PDFParse } from 'pdf-parse'
import { pdf } from 'pdf-to-img'
import sharp from 'sharp'
import { createWorker, type Worker } from 'tesseract.js'

export interface FileProcessingResult {
  filename: string
  text: string
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.gif',
])

// ── File type detection ──────────────────────────────────────────────

function detectFileType(
  filename: string,
  buffer: Buffer,
): 'pdf' | 'image' | 'text' {
  // Magic bytes for PDF
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'pdf'
  }

  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? ''
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'

  return 'text'
}

// ── Tesseract singleton worker ───────────────────────────────────────

let worker: Worker | null = null

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker('por')
  }
  return worker
}

// ── Image preprocessing ──────────────────────────────────────────────

async function preprocessForOcr(
  imageBuffer: Buffer,
  maxWidth: number,
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .withMetadata({ density: 300 })
    .png()
    .toBuffer()
}

// ── Processors ───────────────────────────────────────────────────────

async function processPdf(
  filename: string,
  buffer: Buffer,
): Promise<FileProcessingResult> {
  // 1. Try digital text extraction
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const result = await parser.getText()
  const digitalText = result.text.trim()

  if (digitalText.length > 50) {
    return { filename, text: digitalText }
  }

  // 2. Scanned PDF → render pages and OCR
  const ocrTexts: string[] = []
  const doc = await pdf(buffer)
  const maxPages = Math.min(doc.length, 10)

  for (let i = 1; i <= maxPages; i++) {
    const pageBuffer = await doc.getPage(i)
    const preprocessed = await preprocessForOcr(Buffer.from(pageBuffer), 2000)
    const w = await getWorker()
    const { data } = await w.recognize(preprocessed)

    if (data.confidence >= 50 && data.text.trim().length > 30) {
      ocrTexts.push(data.text.trim())
    }
  }

  if (ocrTexts.length > 0) {
    return { filename, text: ocrTexts.join('\n\n') }
  }

  return { filename, text: `[Imagem clínica anexada: ${filename}]` }
}

async function processImage(
  filename: string,
  buffer: Buffer,
): Promise<FileProcessingResult> {
  const preprocessed = await preprocessForOcr(buffer, 1500)
  const w = await getWorker()
  const { data } = await w.recognize(preprocessed)

  if (data.confidence >= 50 && data.text.trim().length > 30) {
    return { filename, text: data.text.trim() }
  }

  return { filename, text: `[Imagem clínica anexada: ${filename}]` }
}

function processText(
  filename: string,
  buffer: Buffer,
): FileProcessingResult {
  return { filename, text: buffer.toString('utf-8') }
}

// ── Entry point ──────────────────────────────────────────────────────

export async function processFiles(
  filePaths: string[],
): Promise<FileProcessingResult[]> {
  const results: FileProcessingResult[] = []

  for (const filePath of filePaths) {
    const filename = basename(filePath)
    const buffer = await readFile(filePath)
    const type = detectFileType(filename, buffer)

    switch (type) {
      case 'pdf':
        results.push(await processPdf(filename, buffer))
        break
      case 'image':
        results.push(await processImage(filename, buffer))
        break
      default:
        results.push(processText(filename, buffer))
    }
  }

  return results
}
