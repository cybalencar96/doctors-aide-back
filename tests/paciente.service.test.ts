import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import jwtPlugin from '../src/plugins/jwt.js'
import pacientesRoutes from '../src/routes/pacientes.js'

function buildTestApp(prismaOverride: any) {
  const app = Fastify()
  app.decorate('prisma', prismaOverride)
  app.register(jwtPlugin)
  app.register(pacientesRoutes)
  return app
}

function getAuthHeader(app: any): string {
  const token = app.jwt.sign({ medico_id: 'uuid-med-1', crm: '12345' })
  return `Bearer ${token}`
}

describe('POST /cadastrar-paciente', () => {
  it('should create patient successfully', async () => {
    const createdPatient = {
      id: 'uuid-pac-1',
      nome_completo: 'João Silva',
      cpf: '12345678901',
      data_nascimento: new Date('1990-01-15'),
      sexo: 'M',
      telefone: null,
      email: null,
      created_at: new Date(),
    }

    const mockPrisma = {
      paciente: {
        create: vi.fn().mockResolvedValue(createdPatient),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: {
        nome_completo: 'João Silva',
        cpf: '12345678901',
        data_nascimento: '1990-01-15',
        sexo: 'M',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.payload)
    expect(body.id).toBe('uuid-pac-1')
    expect(body.nome_completo).toBe('João Silva')
  })

  it('should return 409 for duplicate CPF', async () => {
    const mockPrisma = {
      paciente: {
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: {
        nome_completo: 'Maria Santos',
        cpf: '12345678901',
        data_nascimento: '1985-06-20',
        sexo: 'F',
      },
    })

    expect(response.statusCode).toBe(409)
    const body = JSON.parse(response.payload)
    expect(body.error).toBe('CPF já cadastrado')
  })

  it('should return 401 without auth token', async () => {
    const mockPrisma = { paciente: { create: vi.fn() } }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      payload: {
        nome_completo: 'Test',
        cpf: '12345678901',
        data_nascimento: '1990-01-01',
        sexo: 'M',
      },
    })

    expect(response.statusCode).toBe(401)
  })
})

describe('GET /buscar-pacientes', () => {
  it('should search patients by name', async () => {
    const mockPrisma = {
      paciente: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'uuid-1', nome_completo: 'João Silva', cpf: '12345678901' },
        ]),
      },
    }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=João',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body).toHaveLength(1)
    expect(body[0].nome_completo).toBe('João Silva')
  })

  it('should return 400 when query is missing', async () => {
    const mockPrisma = { paciente: { findMany: vi.fn() } }

    const app = buildTestApp(mockPrisma)
    await app.ready()
    const response = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(response.statusCode).toBe(400)
  })
})
