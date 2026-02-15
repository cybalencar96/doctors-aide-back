import { describe, it, expect, vi } from 'vitest'
import {
  buildTestApp, getAuthHeader, makePaciente,
  MEDICO_ID, OTHER_MEDICO_ID, PACIENTE_ID, INVALID_UUID,
} from './helpers/test-utils.js'
import pacientesRoutes from '../src/routes/pacientes.js'

function buildApp(prismaOverride: unknown) {
  return buildTestApp(prismaOverride, (app) => {
    app.register(pacientesRoutes)
  })
}

const VALID_PATIENT_PAYLOAD = {
  nome_completo: 'Maria Santos',
  cpf: '12345678901',
  data_nascimento: '1990-05-15',
  sexo: 'F',
}

// ── POST /cadastrar-paciente ──
describe('POST /cadastrar-paciente', () => {
  it('201 with complete patient object', async () => {
    const paciente = makePaciente()
    const app = buildApp({ paciente: { create: vi.fn().mockResolvedValue(paciente) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe(PACIENTE_ID)
  })

  it('201 with telefone and email included', async () => {
    const paciente = makePaciente({ telefone: '11999999999', email: 'maria@email.com' })
    const app = buildApp({ paciente: { create: vi.fn().mockResolvedValue(paciente) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, telefone: '11999999999', email: 'maria@email.com' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().telefone).toBe('11999999999')
    expect(res.json().email).toBe('maria@email.com')
  })

  it('201 with telefone and email omitted', async () => {
    const paciente = makePaciente({ telefone: null, email: null })
    const app = buildApp({ paciente: { create: vi.fn().mockResolvedValue(paciente) } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().telefone).toBeNull()
    expect(res.json().email).toBeNull()
  })

  it('passes medico_id from JWT to prisma.create', async () => {
    const createFn = vi.fn().mockResolvedValue(makePaciente())
    const app = buildApp({ paciente: { create: createFn } })
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(createFn).toHaveBeenCalledOnce()
    expect(createFn.mock.calls[0][0].data.medico_id).toBe(MEDICO_ID)
  })

  it('401 without token', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(401)
  })

  it('401 with malformed token', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: 'Bearer invalid.token.here' },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(401)
  })

  it('400 for empty body', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when nome_completo is empty', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, nome_completo: '' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when cpf has 10 digits', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, cpf: '1234567890' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when cpf has 12 digits', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, cpf: '123456789012' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when cpf contains letters', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, cpf: '1234567890a' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 for data_nascimento before 1900', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, data_nascimento: '1899-12-31' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 for data_nascimento in the future', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    // Schema validates year <= current year, so use a year far in the future
    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, data_nascimento: '2999-01-01' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 for data_nascimento invalid string', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, data_nascimento: 'not-a-date' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when sexo is empty', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, sexo: '' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when email has invalid format', async () => {
    const app = buildApp({ paciente: { create: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: { ...VALID_PATIENT_PAYLOAD, email: 'not-an-email' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('409 when Prisma throws P2002', async () => {
    const app = buildApp({
      paciente: { create: vi.fn().mockRejectedValue({ code: 'P2002' }) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toBe('CPF já cadastrado')
  })

  it('500 when Prisma throws generic error', async () => {
    const app = buildApp({
      paciente: { create: vi.fn().mockRejectedValue(new Error('DB error')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/cadastrar-paciente',
      headers: { authorization: getAuthHeader(app) },
      payload: VALID_PATIENT_PAYLOAD,
    })

    expect(res.statusCode).toBe(500)
  })
})

// ── GET /buscar-pacientes ──
describe('GET /buscar-pacientes', () => {
  it('200 with found patients', async () => {
    const pacientes = [makePaciente()]
    const app = buildApp({ paciente: { findMany: vi.fn().mockResolvedValue(pacientes) } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=Maria',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].nome_completo).toBe('Maria Santos')
  })

  it('200 with empty array when no results', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn().mockResolvedValue([]) } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=Inexistente',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('401 without token', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/buscar-pacientes?query=x' })
    expect(res.statusCode).toBe(401)
  })

  it('400 when query is absent', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when query is empty string', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 when query is whitespace only', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=%20%20',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
  })

  it('500 when DB throws error', async () => {
    const app = buildApp({
      paciente: { findMany: vi.fn().mockRejectedValue(new Error('DB error')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=Maria',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(500)
  })

  it('filters by medico_id in findMany', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const app = buildApp({ paciente: { findMany } })
    await app.ready()

    await app.inject({
      method: 'GET',
      url: '/buscar-pacientes?query=Test',
      headers: { authorization: getAuthHeader(app) },
    })

    expect(findMany).toHaveBeenCalledOnce()
    expect(findMany.mock.calls[0][0].where.medico_id).toBe(MEDICO_ID)
  })
})

// ── GET /medico/:id/pacientes ──
describe('GET /medico/:id/pacientes', () => {
  it('200 with list of patients', async () => {
    const pacientes = [makePaciente()]
    const app = buildApp({ paciente: { findMany: vi.fn().mockResolvedValue(pacientes) } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/pacientes`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
  })

  it('200 with empty array', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn().mockResolvedValue([]) } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/pacientes`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('401 without token', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({ method: 'GET', url: `/medico/${MEDICO_ID}/pacientes` })
    expect(res.statusCode).toBe(401)
  })

  it('400 when :id is not a valid UUID', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${INVALID_UUID}/pacientes`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('ID inválido')
  })

  it('403 when :id does not match JWT medico_id', async () => {
    const app = buildApp({ paciente: { findMany: vi.fn() } })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${OTHER_MEDICO_ID}/pacientes`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Acesso negado')
  })

  it('500 when DB throws error', async () => {
    const app = buildApp({
      paciente: { findMany: vi.fn().mockRejectedValue(new Error('DB error')) },
    })
    await app.ready()

    const res = await app.inject({
      method: 'GET',
      url: `/medico/${MEDICO_ID}/pacientes`,
      headers: { authorization: getAuthHeader(app) },
    })

    expect(res.statusCode).toBe(500)
  })
})
