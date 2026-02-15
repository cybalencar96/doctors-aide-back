import Fastify, { type FastifyInstance } from 'fastify'
import jwtPlugin from '../../src/plugins/jwt.js'
import FormData from 'form-data'

// ── Valid UUID constants ──
export const MEDICO_ID = '00000000-0000-4000-a000-000000000001'
export const OTHER_MEDICO_ID = '00000000-0000-4000-a000-000000000002'
export const PACIENTE_ID = '00000000-0000-4000-a000-000000000010'
export const ATENDIMENTO_ID = '00000000-0000-4000-a000-000000000020'
export const NONEXISTENT_ID = '00000000-0000-4000-a000-ffffffffffff'
export const INVALID_UUID = 'not-a-uuid'

// ── App builders ──
export function buildTestApp(
  prismaOverride: unknown,
  registerRoutes: (app: FastifyInstance) => void,
) {
  const app = Fastify({ logger: false })
  app.decorate('prisma', prismaOverride)
  app.register(jwtPlugin)
  registerRoutes(app)
  return app
}

export async function buildMultipartTestApp(
  prismaOverride: unknown,
  registerRoutes: (app: FastifyInstance) => void,
  multipartOpts?: { limits?: { fileSize?: number; files?: number } },
) {
  const multipartPlugin = await import('../../src/plugins/multipart.js')
  const app = Fastify({ logger: false })
  app.decorate('prisma', prismaOverride)
  app.register(jwtPlugin)

  if (multipartOpts) {
    const multipart = await import('@fastify/multipart')
    app.register(multipart.default, { limits: multipartOpts.limits })
  } else {
    app.register(multipartPlugin.default)
  }

  registerRoutes(app)
  return app
}

// ── Auth helper ──
export function getAuthHeader(app: FastifyInstance, medicoId?: string): string {
  const token = app.jwt.sign({ medico_id: medicoId ?? MEDICO_ID, crm: '12345' })
  return `Bearer ${token}`
}

// ── Mock factories ──
export function makeMedico(overrides: Record<string, unknown> = {}) {
  return {
    id: MEDICO_ID,
    nome_completo: 'Dr. João Silva',
    crm: '12345',
    uf_crm: 'SP',
    ativo: true,
    created_at: new Date('2024-01-01'),
    ...overrides,
  }
}

export function makePaciente(overrides: Record<string, unknown> = {}) {
  return {
    id: PACIENTE_ID,
    medico_id: MEDICO_ID,
    nome_completo: 'Maria Santos',
    cpf: '12345678901',
    data_nascimento: new Date('1990-05-15'),
    sexo: 'F',
    telefone: '11999999999',
    email: 'maria@email.com',
    created_at: new Date('2024-01-10'),
    ...overrides,
  }
}

export function makeAtendimento(overrides: Record<string, unknown> = {}) {
  return {
    id: ATENDIMENTO_ID,
    medico_id: MEDICO_ID,
    paciente_id: PACIENTE_ID,
    texto_historico: null,
    texto_consulta_atual: null,
    status: 'concluido',
    erro: null,
    prontuario: 'Prontuário completo',
    data_inicio: new Date('2024-06-01'),
    data_fim: new Date('2024-06-01'),
    arquivos: [],
    ...overrides,
  }
}

export function makeAtendimentoWithPaciente(overrides: Record<string, unknown> = {}) {
  return {
    ...makeAtendimento(),
    paciente: makePaciente(),
    ...overrides,
  }
}

// ── Multipart payload builder ──
export function buildMultipartPayload(
  fields: Record<string, string>,
  files?: { fieldname: string; filename: string; content: Buffer | string }[],
): { payload: Buffer; headers: Record<string, string> } {
  const form = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }

  if (files) {
    for (const file of files) {
      form.append(file.fieldname, file.content, { filename: file.filename })
    }
  }

  return {
    payload: form.getBuffer(),
    headers: form.getHeaders() as Record<string, string>,
  }
}
