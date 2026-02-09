import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const STORAGE_DIR = join(process.cwd(), 'storage')

interface BufferedFile {
  buffer: Buffer
  filename: string
}

export async function saveBufferedFiles(atendimentoId: string, files: BufferedFile[]): Promise<string[]> {
  const dir = join(STORAGE_DIR, atendimentoId, 'arquivos')
  await mkdir(dir, { recursive: true })

  const paths: string[] = []

  for (const file of files) {
    const filePath = join(dir, file.filename)
    await writeFile(filePath, file.buffer)
    paths.push(filePath)
  }

  return paths
}

export async function saveBufferedAudio(atendimentoId: string, file: BufferedFile): Promise<string> {
  const dir = join(STORAGE_DIR, atendimentoId, 'audio')
  await mkdir(dir, { recursive: true })

  const filePath = join(dir, file.filename)
  await writeFile(filePath, file.buffer)

  return filePath
}
