import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import jwtPlugin from '../src/plugins/jwt.js'
import authRoutes from '../src/routes/auth.js'

function buildTestApp(prismaOverride: any) {
  const app = Fastify()
  app.decorate('prisma', prismaOverride)
  app.register(jwtPlugin)
  app.register(authRoutes)
  return app
}

describe('POST /login-medico', () => {
  it('should return token for active doctor', async () => {
    const mockPrisma = {
      medico: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'uuid-123',
          nome_completo: 'Dr. João',
          crm: '12345',
          uf_crm: 'SP',
          ativo: true,
        }),
      },
    }

    const app = buildTestApp(mockPrisma)
    const response = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.token).toBeDefined()
    expect(body.medico_id).toBe('uuid-123')
  })

  it('should return 404 when doctor not found', async () => {
    const mockPrisma = {
      medico: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }

    const app = buildTestApp(mockPrisma)
    const response = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '99999', uf_crm: 'RJ' },
    })

    expect(response.statusCode).toBe(404)
    const body = JSON.parse(response.payload)
    expect(body.error).toBe('Médico não encontrado')
  })

  it('should return 403 when doctor is inactive', async () => {
    const mockPrisma = {
      medico: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'uuid-456',
          nome_completo: 'Dr. Maria',
          crm: '54321',
          uf_crm: 'MG',
          ativo: false,
        }),
      },
    }

    const app = buildTestApp(mockPrisma)
    const response = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '54321', uf_crm: 'MG' },
    })

    expect(response.statusCode).toBe(403)
    const body = JSON.parse(response.payload)
    expect(body.error).toBe('Médico inativo')
  })

  it('should return 400 for invalid body', async () => {
    const mockPrisma = { medico: { findUnique: vi.fn() } }

    const app = buildTestApp(mockPrisma)
    const response = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '' },
    })

    expect(response.statusCode).toBe(400)
  })
})
