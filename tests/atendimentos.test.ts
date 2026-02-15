import { describe, it, expect, vi } from 'vitest'
import {
  buildTestApp, getAuthHeader, makeAtendimento, makeAtendimentoWithPaciente,
  MEDICO_ID, OTHER_MEDICO_ID, ATENDIMENTO_ID, NONEXISTENT_ID, INVALID_UUID,
} from './helpers/test-utils.js'
import atendimentosRoutes from '../src/routes/atendimentos.js'

vi.mock('../src/services/storage.service.js', () => ({
  saveBufferedFiles: vi.fn().mockResolvedValue([]),
  saveBufferedAudio: vi.fn().mockResolvedValue(''),
}))
vi.mock('../src/services/file-processor.service.js', () => ({
  processFiles: vi.fn().mockResolvedValue([]),
}))
vi.mock('../src/services/ai/ai-client.js', () => ({
  transcribeAudio: vi.fn().mockResolvedValue(''),
  chatCompletion: vi.fn().mockResolvedValue(''),
}))
vi.mock('../src/services/ai/agents.js', () => ({
  runAgents: vi.fn().mockResolvedValue('prontuario'),
}))

function buildApp(prismaOverride: unknown) {
  return buildTestApp(prismaOverride, (app) => {
    app.register(atendimentosRoutes)
  })
}

// ── GET /medico/:id/atendimentos ──
describe('GET /medico/:id/atendimentos', () => {
  it('200 with mapped list of atendimentos', async () => {
    const atendimentos = [makeAtendimentoWithPaciente()]
    const app = buildApp({
      atendimento_mvp: { findMany: vi.fn().mockResolvedValue(atendimentos) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].atendimento_id).toBe(ATENDIMENTO_ID)
  })

  it('verifies response shape: atendimento_id, data_inicio, status, paciente, prontuario, documentos', async () => {
    const atendimentos = [makeAtendimentoWithPaciente()]
    const app = buildApp({
      atendimento_mvp: { findMany: vi.fn().mockResolvedValue(atendimentos) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    const item = res.json()[0]
    expect(item).toHaveProperty('atendimento_id')
    expect(item).toHaveProperty('data_inicio')
    expect(item).toHaveProperty('status')
    expect(item).toHaveProperty('paciente')
    expect(item).toHaveProperty('prontuario')
    expect(item).toHaveProperty('documentos')
    expect(item.paciente).toHaveProperty('id')
    expect(item.paciente).toHaveProperty('nome')
    expect(item.paciente).toHaveProperty('data_nascimento')
    expect(item.paciente).toHaveProperty('sexo')
    expect(item.paciente).toHaveProperty('cpf')
    expect(item.paciente).toHaveProperty('telefone')
    expect(item.paciente).toHaveProperty('email')
  })

  it('200 with empty array', async () => {
    const app = buildApp({
      atendimento_mvp: { findMany: vi.fn().mockResolvedValue([]) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('401 without token', async () => {
    const app = buildApp({ atendimento_mvp: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({ method: 'GET', url: `/medico/${MEDICO_ID}/atendimentos` })
    expect(res.statusCode).toBe(401)
  })

  it('400 when :id is not a valid UUID', async () => {
    const app = buildApp({ atendimento_mvp: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${INVALID_UUID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('ID inválido')
  })

  it('403 when :id does not match JWT', async () => {
    const app = buildApp({ atendimento_mvp: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${OTHER_MEDICO_ID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(403)
  })

  it('500 when DB throws error', async () => {
    const app = buildApp({
      atendimento_mvp: { findMany: vi.fn().mockRejectedValue(new Error('DB error')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/atendimentos`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(500)
  })
})

// ── GET /atendimento/:id ──
describe('GET /atendimento/:id', () => {
  it('200 with {status, prontuario, erro}', async () => {
    const atendimento = makeAtendimento({ status: 'concluido', prontuario: 'Prontuário completo', erro: null })
    const app = buildApp({
      atendimento_mvp: { findUnique: vi.fn().mockResolvedValue(atendimento) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${ATENDIMENTO_ID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('concluido')
    expect(body.prontuario).toBe('Prontuário completo')
    expect(body.erro).toBeNull()
  })

  it('200 with erro field when status is "erro"', async () => {
    const atendimento = makeAtendimento({ status: 'erro', prontuario: null, erro: 'Falha no processamento' })
    const app = buildApp({
      atendimento_mvp: { findUnique: vi.fn().mockResolvedValue(atendimento) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${ATENDIMENTO_ID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('erro')
    expect(res.json().erro).toBe('Falha no processamento')
  })

  it('401 without token', async () => {
    const app = buildApp({ atendimento_mvp: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({ method: 'GET', url: `/atendimento/${ATENDIMENTO_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('400 when :id is not a valid UUID', async () => {
    const app = buildApp({ atendimento_mvp: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${INVALID_UUID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 when not found', async () => {
    const app = buildApp({
      atendimento_mvp: { findUnique: vi.fn().mockResolvedValue(null) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${NONEXISTENT_ID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Atendimento não encontrado')
  })

  it('403 when atendimento belongs to another doctor', async () => {
    const atendimento = makeAtendimento({ medico_id: OTHER_MEDICO_ID })
    const app = buildApp({
      atendimento_mvp: { findUnique: vi.fn().mockResolvedValue(atendimento) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${ATENDIMENTO_ID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Acesso negado')
  })

  it('500 when DB throws error', async () => {
    const app = buildApp({
      atendimento_mvp: { findUnique: vi.fn().mockRejectedValue(new Error('DB error')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/atendimento/${ATENDIMENTO_ID}`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(500)
  })
})
