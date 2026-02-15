import { describe, it, expect, vi } from 'vitest'
import { buildTestApp, makeMedico, MEDICO_ID } from './helpers/test-utils.js'
import authRoutes from '../src/routes/auth.js'

function buildApp(prismaOverride: unknown) {
  return buildTestApp(prismaOverride, (app) => {
    app.register(authRoutes)
  })
}

describe('POST /login-medico', () => {
  it('200 with token, id, nome_completo, crm for active doctor', async () => {
    const medico = makeMedico()
    const app = buildApp({ medico: { findUnique: vi.fn().mockResolvedValue(medico) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeDefined()
    expect(body.id).toBe(MEDICO_ID)
    expect(body.nome_completo).toBe('Dr. João Silva')
    expect(body.crm).toBe('12345')
  })

  it('verifies exact response body shape', async () => {
    const medico = makeMedico()
    const app = buildApp({ medico: { findUnique: vi.fn().mockResolvedValue(medico) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    const body = res.json()
    expect(Object.keys(body).sort()).toEqual(['crm', 'id', 'nome_completo', 'token'])
  })

  it('400 for empty body', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({ method: 'POST', url: '/login-medico', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('400 when crm is empty string', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '', uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when uf_crm has 1 character', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'S' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when uf_crm has 3 characters', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SPX' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when crm is absent', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when uf_crm is absent', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 when doctor not found', async () => {
    const app = buildApp({ medico: { findUnique: vi.fn().mockResolvedValue(null) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '99999', uf_crm: 'RJ' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toBe('Médico não encontrado')
  })

  it('403 when doctor is inactive', async () => {
    const medico = makeMedico({ ativo: false })
    const app = buildApp({ medico: { findUnique: vi.fn().mockResolvedValue(medico) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Médico inativo')
  })

  it('500 when DB throws error on findUnique', async () => {
    const app = buildApp({
      medico: { findUnique: vi.fn().mockRejectedValue(new Error('DB down')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(500)
  })

  it('500 when jwt.sign throws error', async () => {
    const medico = makeMedico()
    const app = buildApp({ medico: { findUnique: vi.fn().mockResolvedValue(medico) } })
    await app.ready()

    // Override jwt.sign to throw
    const originalSign = app.jwt.sign
    app.jwt.sign = () => { throw new Error('JWT sign failed') }

    const res = await app.inject({
      method: 'POST',
      url: '/login-medico',
      payload: { crm: '12345', uf_crm: 'SP' },
    })

    expect(res.statusCode).toBe(500)
    app.jwt.sign = originalSign
  })
})
