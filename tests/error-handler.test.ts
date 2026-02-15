import { describe, it, expect, vi, beforeAll } from 'vitest'
import { AppError, HttpStatus } from '../src/errors.js'
import { Prisma } from '../generated/prisma/client.js'
import type { FastifyInstance } from 'fastify'

// Mock plugins/services that need external connections
vi.mock('../src/plugins/prisma.js', () => {
  const fp = import('fastify-plugin')
  return fp.then((mod) => ({
    default: mod.default(async () => {}),
  }))
})

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

let app: FastifyInstance

beforeAll(async () => {
  const { buildApp } = await import('../src/app.js')
  app = await buildApp()

  // Decorate prisma with minimal mock needed for routes
  app.decorate('prisma', {
    medico: { findUnique: vi.fn() },
    paciente: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    atendimento_mvp: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  })

  // Register test routes that throw specific errors
  app.get('/test/app-error', async () => {
    throw new AppError(HttpStatus.BAD_REQUEST, 'Custom app error', { field: 'test' })
  })

  app.get('/test/app-error-no-details', async () => {
    throw new AppError(HttpStatus.FORBIDDEN, 'Forbidden action')
  })

  app.get('/test/prisma-p2002', async () => {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '0.0.0',
    })
  })

  app.get('/test/prisma-p2025', async () => {
    throw new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '0.0.0',
    })
  })

  app.get('/test/prisma-unmapped', async () => {
    throw new Prisma.PrismaClientKnownRequestError('Other', {
      code: 'P9999',
      clientVersion: '0.0.0',
    })
  })

  app.get('/test/prisma-validation', async () => {
    throw new Prisma.PrismaClientValidationError('Validation failed', {
      clientVersion: '0.0.0',
    })
  })

  app.get('/test/status-error', async () => {
    const err = new Error('Rate limit') as Error & { statusCode: number }
    err.statusCode = 429
    throw err
  })

  app.get('/test/unknown-error', async () => {
    throw new Error('Something unexpected')
  })

  await app.ready()
})

describe('Global Error Handler', () => {
  it('returns statusCode and message for AppError', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/app-error' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Custom app error')
  })

  it('includes details when AppError has details', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/app-error' })

    expect(res.json().details).toEqual({ field: 'test' })
  })

  it('omits details when AppError has no details', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/app-error-no-details' })

    expect(res.statusCode).toBe(403)
    expect(res.json()).not.toHaveProperty('details')
  })

  it('409 for PrismaClientKnownRequestError P2002', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/prisma-p2002' })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('Conflito: registro já existe')
  })

  it('404 for PrismaClientKnownRequestError P2025', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/prisma-p2025' })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Registro não encontrado')
  })

  it('500 for PrismaClientKnownRequestError unmapped code', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/prisma-unmapped' })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Erro interno do servidor')
  })

  it('400 for PrismaClientValidationError', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/prisma-validation' })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Erro de validação nos dados enviados')
  })

  it('passes statusCode < 500 from error', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/status-error' })

    expect(res.statusCode).toBe(429)
    expect(res.json().error).toBe('Rate limit')
  })

  it('500 with generic message for unknown error', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/unknown-error' })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toBe('Erro interno do servidor')
  })
})

describe('Not Found Handler', () => {
  it('404 for non-existent route', async () => {
    const res = await app.inject({ method: 'GET', url: '/non-existent-route' })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Rota não encontrada')
  })
})
