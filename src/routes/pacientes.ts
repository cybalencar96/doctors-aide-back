import type { FastifyInstance } from 'fastify'
import { cadastrarPacienteSchema } from '../schemas/paciente.schema.js'

export default async function pacientesRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.post('/cadastrar-paciente', async (request, reply) => {
    const parsed = cadastrarPacienteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const { data_nascimento, ...rest } = parsed.data

    try {
      const paciente = await fastify.prisma.paciente.create({
        data: {
          ...rest,
          data_nascimento: new Date(data_nascimento),
        },
      })
      return reply.status(201).send(paciente)
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send({ error: 'CPF já cadastrado' })
      }
      throw err
    }
  })

  fastify.get('/buscar-pacientes', async (request, reply) => {
    const { query } = request.query as { query?: string }

    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Parâmetro "query" é obrigatório' })
    }

    const pacientes = await fastify.prisma.paciente.findMany({
      where: {
        nome_completo: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 20,
    })

    return pacientes
  })

  fastify.get('/medico/:id/pacientes', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pacientes = await fastify.prisma.paciente.findMany({
      where: {
        atendimentos: {
          some: { medico_id: id },
        },
      },
    })

    return pacientes
  })
}
