import OpenAI from 'openai'
import { createReadStream } from 'node:fs'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const model = process.env.AI_MODEL || 'gpt-4o'

export async function chatCompletion(systemPrompt: string, userContent: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function transcribeAudio(filePath: string): Promise<string> {
  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: createReadStream(filePath),
  })

  return response.text
}
