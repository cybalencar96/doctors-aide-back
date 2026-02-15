import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { AppError, HttpStatus } from '../errors.js'

const STORAGE_DIR = join(process.cwd(), 'storage')

interface BufferedFile {
  buffer: Buffer
  filename: string
}

async function ensureDir(dir: string, context: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch (err) {
    throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, `Falha ao criar diretório: ${context}`, err)
  }
}

async function writeSafe(filePath: string, data: Buffer, context: string): Promise<void> {
  try {
    await writeFile(filePath, data)
  } catch (err) {
    throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, `Falha ao salvar arquivo: ${context}`, err)
  }
}

export async function saveBufferedFiles(atendimentoId: string, files: BufferedFile[]): Promise<string[]> {
  const dir = join(STORAGE_DIR, atendimentoId, 'arquivos')
  await ensureDir(dir, `arquivos do atendimento ${atendimentoId}`)

  const paths: string[] = []
  for (const file of files) {
    const filePath = join(dir, basename(file.filename))
    await writeSafe(filePath, file.buffer, `${file.filename} do atendimento ${atendimentoId}`)
    paths.push(filePath)
  }

  return paths
}

export async function saveBufferedAudio(atendimentoId: string, file: BufferedFile): Promise<string> {
  const dir = join(STORAGE_DIR, atendimentoId, 'audio')
  await ensureDir(dir, `áudio do atendimento ${atendimentoId}`)

  const filePath = join(dir, basename(file.filename))
  await writeSafe(filePath, file.buffer, `${file.filename} do atendimento ${atendimentoId}`)

  return filePath
}
