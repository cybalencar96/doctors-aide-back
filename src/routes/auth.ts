import type { FastifyInstance } from 'fastify'
import { loginSchema } from '../schemas/medico.schema.js'
import { AppError, HttpStatus } from '../errors.js'

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login-medico', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const { crm, uf_crm } = parsed.data

    let medico
    try {
      medico = await fastify.prisma.medico.findUnique({
        where: { crm_uf_crm: { crm, uf_crm } },
      })
    } catch (err) {
      fastify.log.error({ err, crm, uf_crm }, 'Erro ao buscar médico no banco')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao buscar médico')
    }

    if (!medico) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: 'Médico não encontrado' })
    }

    if (!medico.ativo) {
      return reply.status(HttpStatus.FORBIDDEN).send({ error: 'Médico inativo' })
    }

    const token = fastify.jwt.sign({ medico_id: medico.id, crm: medico.crm })

    return { token, id: medico.id, nome_completo: medico.nome_completo, crm: medico.crm }
  })
}
