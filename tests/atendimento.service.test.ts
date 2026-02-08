import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwtPlugin from '../src/plugins/jwt.js'
import atendimentosRoutes from '../src/routes/atendimentos.js'

vi.mock('../src/services/n8n.service.js', () => ({
  processarAtendimento: vi.fn().mockResolvedValue({ prontuario_texto: 'Prontuário gerado' }),
}))

vi.mock('../src/services/storage.service.js', () => ({
  saveFiles: vi.fn().mockResolvedValue(['/storage/id/file.pdf']),
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
            data_inicio: new Date(),
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
    expect(body[0].id).toBe('uuid-at-1')
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
