import type { FastifyInstance } from 'fastify'
import { loginSchema } from '../schemas/medico.schema.js'

// Authentication routes
export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login-medico', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }
    
    const { crm, uf_crm } = parsed.data

    const medico = await fastify.prisma.medico.findUnique({
      where: { crm_uf_crm: { crm, uf_crm } },
    })
    
    if (!medico) {
      return reply.status(404).send({ error: 'Médico não encontrado' })
    }

    if (!medico.ativo) {
      return reply.status(403).send({ error: 'Médico inativo' })
    }

    const token = fastify.jwt.sign({ medico_id: medico.id, crm: medico.crm })

    return { token, id: medico.id, nome_completo: medico.nome_completo, crm: medico.crm }
  })
}
