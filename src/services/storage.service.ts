import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MultipartFile } from '@fastify/multipart'

const STORAGE_DIR = join(process.cwd(), 'storage')

export async function saveFiles(atendimentoId: string, files: MultipartFile[]): Promise<string[]> {
  const dir = join(STORAGE_DIR, atendimentoId)
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
