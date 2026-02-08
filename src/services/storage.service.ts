import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MultipartFile } from '@fastify/multipart'

const STORAGE_DIR = join(process.cwd(), 'storage')

export async function saveFiles(atendimentoId: string, files: MultipartFile[]): Promise<string[]> {
  const dir = join(STORAGE_DIR, atendimentoId, 'arquivos')
  await mkdir(dir, { recursive: true })

  const paths: string[] = []

  for (const file of files) {
    const buffer = await file.toBuffer()
    const filePath = join(dir, file.filename)
    await writeFile(filePath, buffer)
    paths.push(filePath)
  }

  return paths
}

export async function saveAudio(atendimentoId: string, file: MultipartFile): Promise<string> {
  const dir = join(STORAGE_DIR, atendimentoId, 'audio')
  await mkdir(dir, { recursive: true })

  const buffer = await file.toBuffer()
  const filePath = join(dir, file.filename)
  await writeFile(filePath, buffer)

  return filePath
}

export async function readFileContent(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return buffer.toString('utf-8')
}
