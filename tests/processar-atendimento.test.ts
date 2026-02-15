import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildMultipartTestApp, getAuthHeader, buildMultipartPayload, makePaciente,
  MEDICO_ID, OTHER_MEDICO_ID, PACIENTE_ID, ATENDIMENTO_ID, INVALID_UUID,
} from './helpers/test-utils.js'
import atendimentosRoutes from '../src/routes/atendimentos.js'

const mockSaveBufferedFiles = vi.fn().mockResolvedValue(['/storage/id/arquivos/file.pdf'])
const mockSaveBufferedAudio = vi.fn().mockResolvedValue('/storage/id/audio/audio.mp3')
const mockProcessFiles = vi.fn().mockResolvedValue([{ filename: 'file.pdf', text: 'text' }])
const mockTranscribeAudio = vi.fn().mockResolvedValue('transcription')
const mockChatCompletion = vi.fn().mockResolvedValue('result')
const mockRunAgents = vi.fn().mockResolvedValue('prontuario')

vi.mock('../src/services/storage.service.js', () => ({
  saveBufferedFiles: (...args: unknown[]) => mockSaveBufferedFiles(...args),
  saveBufferedAudio: (...args: unknown[]) => mockSaveBufferedAudio(...args),
}))
vi.mock('../src/services/file-processor.service.js', () => ({
  processFiles: (...args: unknown[]) => mockProcessFiles(...args),
}))
vi.mock('../src/services/ai/ai-client.js', () => ({
  transcribeAudio: (...args: unknown[]) => mockTranscribeAudio(...args),
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}))
vi.mock('../src/services/ai/agents.js', () => ({
  runAgents: (...args: unknown[]) => mockRunAgents(...args),
}))

function buildDefaultPrisma(overrides: Record<string, unknown> = {}) {
  return {
    paciente: {
      findUnique: vi.fn().mockResolvedValue({ medico_id: MEDICO_ID }),
    },
    atendimento_mvp: {
      create: vi.fn().mockResolvedValue({ id: ATENDIMENTO_ID }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
}

async function buildApp(prismaOverride?: unknown) {
  const prisma = prismaOverride ?? buildDefaultPrisma()
  return buildMultipartTestApp(prisma, (app) => {
    app.register(atendimentosRoutes)
  })
}

async function buildAppWithSmallLimit(prismaOverride?: unknown) {
  const prisma = prismaOverride ?? buildDefaultPrisma()
  return buildMultipartTestApp(
    prisma,
    (app) => { app.register(atendimentosRoutes) },
    { limits: { fileSize: 10 } },
  )
}

const VALID_FIELDS = {
  paciente_id: PACIENTE_ID,
  paciente_nome: 'Maria Santos',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSaveBufferedFiles.mockResolvedValue(['/storage/id/arquivos/file.pdf'])
  mockSaveBufferedAudio.mockResolvedValue('/storage/id/audio/audio.mp3')
  mockProcessFiles.mockResolvedValue([{ filename: 'file.pdf', text: 'text' }])
  mockTranscribeAudio.mockResolvedValue('transcription')
  mockRunAgents.mockResolvedValue('prontuario')
})

describe('POST /processar-atendimento', () => {
  // ── Auth ──
  describe('autenticação', () => {
    it('401 without token', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers,
      })

      expect(res.statusCode).toBe(401)
    })
  })

  // ── File extension validation ──
  describe('validação de arquivos multipart', () => {
    it('400 when audio has forbidden extension (.exe)', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'audio', filename: 'audio.exe', content: Buffer.from('data') },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('Extensão de áudio não permitida')
    })

    it('400 when document has forbidden extension (.exe)', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'file.exe', content: Buffer.from('data') },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('Extensão de arquivo não permitida')
    })

    it('413 when file exceeds size limit', async () => {
      const app = await buildAppWithSmallLimit()
      await app.ready()

      const bigContent = Buffer.alloc(100, 'x')
      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'big.pdf', content: bigContent },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(413)
    })

    it('accepts all allowed audio extensions', async () => {
      const extensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg']
      for (const ext of extensions) {
        const app = await buildApp()
        await app.ready()

        const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
          { fieldname: 'audio', filename: `audio${ext}`, content: Buffer.from('data') },
        ])

        const res = await app.inject({
          method: 'POST',
          url: '/processar-atendimento',
          payload,
          headers: { ...headers, authorization: getAuthHeader(app) },
        })

        expect(res.statusCode).not.toBe(400)
      }
    })

    it('accepts all allowed document extensions', async () => {
      const extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.csv', '.doc', '.docx']
      for (const ext of extensions) {
        const app = await buildApp()
        await app.ready()

        const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
          { fieldname: 'arquivo', filename: `file${ext}`, content: Buffer.from('data') },
        ])

        const res = await app.inject({
          method: 'POST',
          url: '/processar-atendimento',
          payload,
          headers: { ...headers, authorization: getAuthHeader(app) },
        })

        expect(res.statusCode).not.toBe(400)
      }
    })
  })

  // ── Zod field validation ──
  describe('validação de campos (Zod)', () => {
    it('400 when paciente_id is absent', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload({ paciente_nome: 'Maria' })
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(400)
    })

    it('400 when paciente_id is not UUID', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload({
        paciente_id: 'not-uuid',
        paciente_nome: 'Maria',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(400)
    })

    it('400 when paciente_nome is empty', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload({
        paciente_id: PACIENTE_ID,
        paciente_nome: '',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ── Patient lookup / authorization ──
  describe('autorização e lookup de paciente', () => {
    it('500 when DB throws error on lookup', async () => {
      const prisma = buildDefaultPrisma({
        paciente: { findUnique: vi.fn().mockRejectedValue(new Error('DB down')) },
      })
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(500)
    })

    it('404 when patient not found', async () => {
      const prisma = buildDefaultPrisma({
        paciente: { findUnique: vi.fn().mockResolvedValue(null) },
      })
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(404)
    })

    it('403 when patient belongs to another doctor', async () => {
      const prisma = buildDefaultPrisma({
        paciente: { findUnique: vi.fn().mockResolvedValue({ medico_id: OTHER_MEDICO_ID }) },
      })
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(403)
    })
  })

  // ── Atendimento creation ──
  describe('criação do atendimento', () => {
    it('500 when DB throws error on create', async () => {
      const prisma = buildDefaultPrisma()
      prisma.atendimento_mvp.create = vi.fn().mockRejectedValue(new Error('DB error'))
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(500)
    })
  })

  // ── File save errors ──
  describe('salvamento de arquivos', () => {
    it('500 with atendimento_id when saveBufferedFiles fails', async () => {
      mockSaveBufferedFiles.mockRejectedValue(new Error('disk full'))
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'doc.pdf', content: Buffer.from('data') },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(500)
      expect(res.json().atendimento_id).toBe(ATENDIMENTO_ID)
    })

    it('500 with atendimento_id when saveBufferedAudio fails', async () => {
      mockSaveBufferedAudio.mockRejectedValue(new Error('disk full'))
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'audio', filename: 'audio.mp3', content: Buffer.from('data') },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(500)
      expect(res.json().atendimento_id).toBe(ATENDIMENTO_ID)
    })

    it('updates status to "erro" when file save fails', async () => {
      mockSaveBufferedFiles.mockRejectedValue(new Error('disk full'))
      const prisma = buildDefaultPrisma()
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'doc.pdf', content: Buffer.from('data') },
      ])

      await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(prisma.atendimento_mvp.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'erro' }),
        }),
      )
    })
  })

  // ── Success cases ──
  describe('processamento com sucesso', () => {
    it('202 with {atendimento_id, status: "processando"} — fields only, no files', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS)
      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(202)
      const body = res.json()
      expect(body.atendimento_id).toBe(ATENDIMENTO_ID)
      expect(body.status).toBe('processando')
    })

    it('202 with files and audio', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'doc.pdf', content: Buffer.from('pdf data') },
        { fieldname: 'audio', filename: 'audio.mp3', content: Buffer.from('audio data') },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(202)
    })

    it('202 with optional consulta_anterior and observacoes', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload({
        ...VALID_FIELDS,
        consulta_anterior: 'Previous consultation notes',
        observacoes: 'Doctor notes',
      })

      const res = await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(res.statusCode).toBe(202)
    })

    it('verifies prisma.create called with correct data', async () => {
      const prisma = buildDefaultPrisma()
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload({
        ...VALID_FIELDS,
        observacoes: 'notes',
        consulta_anterior: 'prev',
      })

      await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(prisma.atendimento_mvp.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          medico_id: MEDICO_ID,
          paciente_id: PACIENTE_ID,
          texto_consulta_atual: 'notes',
          texto_historico: 'prev',
          status: 'processando',
          arquivos: [],
        }),
      })
    })

    it('verifies prisma.update called with file paths after save', async () => {
      const prisma = buildDefaultPrisma()
      const app = await buildApp(prisma)
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'doc.pdf', content: Buffer.from('data') },
      ])

      await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      expect(prisma.atendimento_mvp.update).toHaveBeenCalledWith({
        where: { id: ATENDIMENTO_ID },
        data: { arquivos: ['/storage/id/arquivos/file.pdf'] },
      })
    })

    it('verifies processInBackground is triggered', async () => {
      const app = await buildApp()
      await app.ready()

      const { payload, headers } = buildMultipartPayload(VALID_FIELDS, [
        { fieldname: 'arquivo', filename: 'doc.pdf', content: Buffer.from('data') },
      ])

      await app.inject({
        method: 'POST',
        url: '/processar-atendimento',
        payload,
        headers: { ...headers, authorization: getAuthHeader(app) },
      })

      // Wait for background processing to complete
      await vi.waitFor(() => {
        expect(mockRunAgents).toHaveBeenCalled()
      }, { timeout: 2000 })
    })
  })
})
