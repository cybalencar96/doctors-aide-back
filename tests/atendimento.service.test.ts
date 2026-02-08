import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwtPlugin from '../src/plugins/jwt.js'
import atendimentosRoutes from '../src/routes/atendimentos.js'

vi.mock('../src/services/ai/ai-client.js', () => ({
  chatCompletion: vi.fn().mockResolvedValue('Resultado do agente'),
  transcribeAudio: vi.fn().mockResolvedValue('Transcrição do áudio'),
}))

vi.mock('../src/services/ai/agents.js', () => ({
  runAgents: vi.fn().mockResolvedValue('Prontuário gerado pelos agentes'),
}))

vi.mock('../src/services/storage.service.js', () => ({
  saveFiles: vi.fn().mockResolvedValue(['/storage/id/arquivos/file.pdf']),
  saveAudio: vi.fn().mockResolvedValue('/storage/id/audio/audio.mp3'),
  readFileContent: vi.fn().mockResolvedValue('conteúdo do arquivo'),
}))

function buildTestApp(prismaOverride: any) {
  const app = Fastify()
  app.decorate('prisma', prismaOverride)
  app.register(jwtPlugin)
  app.register(atendimentosRoutes)
  return app
}

function getAuthHeader(app: any): string {
  const token = app.jwt.sign({ medico_id: 'uuid-med-1', crm: '12345' })
  return `Bearer ${token}`
}

describe('GET /medico/:id/atendimentos', () => {
  it('should list atendimentos for a doctor', async () => {
    const mockPrisma = {
      atendimento_mvp: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'uuid-at-1',
            medico_id: 'uuid-med-1',
            paciente_id: 'uuid-pac-1',
            status: 'concluido',
            prontuario: 'Prontuário gerado',
            data_inicio: new Date(),
            arquivos: [],
            paciente: {
              id: 'uuid-pac-1',
              nome_completo: 'João Silva',
              data_nascimento: new Date('1990-01-15'),
              sexo: 'M',
              cpf: '12345678901',
              telefone: '11999999999',
              email: 'joao@email.com',
            },
          },
        ]),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'GET',
      url: '/medico/uuid-med-1/atendimentos',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body).toHaveLength(1)
    expect(body[0].atendimento_id).toBe('uuid-at-1')
    expect(body[0].paciente.id).toBe('uuid-pac-1')
    expect(body[0].paciente.nome).toBe('João Silva')
  })
})

describe('GET /atendimento/:id', () => {
  it('should return atendimento status and prontuario', async () => {
    const mockPrisma = {
      atendimento_mvp: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'uuid-at-1',
          status: 'concluido',
          prontuario: 'Prontuário completo',
        }),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'GET',
      url: '/atendimento/uuid-at-1',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.status).toBe('concluido')
    expect(body.prontuario).toBe('Prontuário completo')
  })

  it('should return 404 for non-existent atendimento', async () => {
    const mockPrisma = {
      atendimento_mvp: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'GET',
      url: '/atendimento/uuid-nonexistent',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(response.statusCode).toBe(404)
  })
})
