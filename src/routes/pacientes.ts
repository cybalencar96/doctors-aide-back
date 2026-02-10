import type { FastifyInstance } from 'fastify'
import { cadastrarPacienteSchema } from '../schemas/paciente.schema.js'
import { AppError, HttpStatus, isErrorWithCode } from '../errors.js'

export default async function pacientesRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.post('/cadastrar-paciente', async (request, reply) => {
    const parsed = cadastrarPacienteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const { data_nascimento, ...rest } = parsed.data

    try {
      const paciente = await fastify.prisma.paciente.create({
        data: {
          ...rest,
          medico_id: request.user.medico_id,
          data_nascimento: new Date(data_nascimento),
        },
      })
      return reply.status(HttpStatus.CREATED).send(paciente)
    } catch (err) {
      if (isErrorWithCode(err) && err.code === 'P2002') {
        return reply.status(HttpStatus.CONFLICT).send({ error: 'CPF já cadastrado' })
      }
      throw err
    }
  })

  fastify.get('/buscar-pacientes', async (request, reply) => {
    const { query } = request.query as { query?: string }

    if (!query || query.trim().length === 0) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: 'Parâmetro "query" é obrigatório' })
    }

    try {
      const pacientes = await fastify.prisma.paciente.findMany({
        where: {
          medico_id: request.user.medico_id,
          nome_completo: {
            contains: query,
            mode: 'insensitive',
          },
        },
        take: 20,
      })

      return pacientes
    } catch (err) {
      fastify.log.error({ err, query }, 'Erro ao buscar pacientes')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao buscar pacientes')
    }
  })

  fastify.get('/medico/:id/pacientes', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const pacientes = await fastify.prisma.paciente.findMany({
        where: { medico_id: id },
      })

      return pacientes
    } catch (err) {
      fastify.log.error({ err, medico_id: id }, 'Erro ao listar pacientes do médico')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao listar pacientes')
    }
  })
}
