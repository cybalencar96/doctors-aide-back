import type { FastifyInstance } from 'fastify'
import { processarAtendimentoSchema } from '../schemas/atendimento.schema.js'
import { saveFiles } from '../services/storage.service.js'
import { processarAtendimento } from '../services/n8n.service.js'

export default async function atendimentosRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/medico/:id/atendimentos', async (request, reply) => {
    const { id } = request.params as { id: string }

    const atendimentos = await fastify.prisma.atendimento_mvp.findMany({
      where: { medico_id: id },
      orderBy: { data_inicio: 'desc' },
    })

    return atendimentos
  })

  fastify.post('/processar-atendimento', async (request, reply) => {
    const parts = request.parts()
    const fields: Record<string, string> = {}
    const files: Parameters<typeof saveFiles>[1] = []

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname] = part.value as string
      } else if (part.type === 'file') {
        files.push(part)
      }
    }

    const parsed = processarAtendimentoSchema.safeParse(fields)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const user = request.user
    const { paciente_id, texto_historico, texto_consulta_atual } = parsed.data

    const atendimento = await fastify.prisma.atendimento_mvp.create({
      data: {
        medico_id: user.medico_id,
        paciente_id,
        texto_historico,
        texto_consulta_atual,
        arquivos: [],
      },
    })

    let arquivos: string[] = []
    if (files.length > 0) {
      arquivos = await saveFiles(atendimento.id, files)
      await fastify.prisma.atendimento_mvp.update({
        where: { id: atendimento.id },
        data: { arquivos },
      })
    }

    try {
      const result = await processarAtendimento({
        atendimento_id: atendimento.id,
        medico_id: user.medico_id,
        paciente_id,
        texto_historico,
        texto_consulta_atual,
        arquivos,
      })

      const updated = await fastify.prisma.atendimento_mvp.update({
        where: { id: atendimento.id },
        data: {
          prontuario: result.prontuario_texto,
          status: 'concluido',
          data_fim: new Date(),
        },
      })

      return reply.status(201).send(updated)
    } catch (err) {
      await fastify.prisma.atendimento_mvp.update({
        where: { id: atendimento.id },
        data: { status: 'erro' },
      })

      fastify.log.error(err, 'Erro ao processar atendimento via n8n')
      return reply.status(502).send({
        error: 'Erro ao processar atendimento',
        atendimento_id: atendimento.id,
      })
    }
  })

  fastify.get('/atendimento/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const atendimento = await fastify.prisma.atendimento_mvp.findUnique({
      where: { id },
    })

    if (!atendimento) {
      return reply.status(404).send({ error: 'Atendimento não encontrado' })
    }

    return { status: atendimento.status, prontuario: atendimento.prontuario }
  })
}
