import OpenAI from 'openai'
import { createReadStream } from 'node:fs'
import { AppError, HttpStatus, errorMessage } from '../../errors.js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const model = process.env.AI_MODEL || 'gpt-4o'

export async function chatCompletion(systemPrompt: string, userContent: string): Promise<string> {
  let response
  try {
    response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    })
  } catch (err) {
    throw new AppError(HttpStatus.BAD_GATEWAY, `Falha na comunicação com OpenAI: ${errorMessage(err)}`)
  }

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new AppError(HttpStatus.BAD_GATEWAY, 'OpenAI retornou resposta vazia')
  }

  return content
}

export async function transcribeAudio(filePath: string): Promise<string> {
  let response
  try {
    response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(filePath),
    })
  } catch (err) {
    throw new AppError(HttpStatus.BAD_GATEWAY, `Falha ao transcrever áudio: ${errorMessage(err)}`)
  }

  if (!response.text) {
    throw new AppError(HttpStatus.BAD_GATEWAY, 'OpenAI retornou transcrição vazia')
  }

  return response.text
}
