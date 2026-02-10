import type { FastifyInstance } from 'fastify'
import { processarAtendimentoSchema } from '../schemas/atendimento.schema.js'
import { saveBufferedFiles, saveBufferedAudio } from '../services/storage.service.js'
import { processFiles } from '../services/file-processor.service.js'
import { transcribeAudio } from '../services/ai/ai-client.js'
import { runAgents } from '../services/ai/agents.js'
import { AppError, HttpStatus, errorMessage } from '../errors.js'

interface BufferedFile {
  buffer: Buffer
  filename: string
}

export default async function atendimentosRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/medico/:id/atendimentos', async (request, reply) => {
    const { id } = request.params as { id: string }

    let atendimentos
    try {
      atendimentos = await fastify.prisma.atendimento_mvp.findMany({
        where: { medico_id: id },
        orderBy: { data_inicio: 'desc' },
        include: { paciente: true },
      })
    } catch (err) {
      fastify.log.error({ err, medico_id: id }, 'Erro ao listar atendimentos')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao listar atendimentos')
    }

    return atendimentos.map((a) => ({
      atendimento_id: a.id,
      data_inicio: a.data_inicio,
      status: a.status,
      paciente: {
        id: a.paciente.id,
        nome: a.paciente.nome_completo,
        data_nascimento: a.paciente.data_nascimento,
        sexo: a.paciente.sexo,
        cpf: a.paciente.cpf,
        telefone: a.paciente.telefone,
        email: a.paciente.email,
      },
      prontuario: a.prontuario,
      documentos: a.arquivos,
    }))
  })

  fastify.post('/processar-atendimento', async (request, reply) => {
    const fields: Record<string, string> = {}
    const arquivoFiles: BufferedFile[] = []
    let audioFile: BufferedFile | null = null

    try {
      const parts = request.parts()
      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer()
          if (part.fieldname === 'audio') {
            audioFile = { buffer, filename: part.filename }
          } else {
            arquivoFiles.push({ buffer, filename: part.filename })
          }
        }
      }
    } catch (err) {
      fastify.log.error(err, 'Erro ao processar upload multipart')
      return reply.status(HttpStatus.PAYLOAD_TOO_LARGE).send({
        error: 'Erro no upload dos arquivos. Verifique o tamanho máximo (50 MB por arquivo, 10 arquivos).',
      })
    }

    const parsed = processarAtendimentoSchema.safeParse(fields)
    if (!parsed.success) {
      return reply.status(HttpStatus.BAD_REQUEST).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const user = request.user
    const { paciente_id, paciente_nome, consulta_anterior, observacoes } = parsed.data

    let atendimento
    try {
      atendimento = await fastify.prisma.atendimento_mvp.create({
        data: {
          medico_id: user.medico_id,
          paciente_id,
          texto_consulta_atual: observacoes,
          texto_historico: consulta_anterior,
          arquivos: [],
          status: 'processando',
        },
      })
    } catch (err) {
      fastify.log.error({ err, medico_id: user.medico_id, paciente_id }, 'Erro ao criar atendimento')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao criar atendimento')
    }

    let arquivoPaths: string[] = []
    let audioPath: string | null = null

    try {
      if (arquivoFiles.length > 0) {
        arquivoPaths = await saveBufferedFiles(atendimento.id, arquivoFiles)
        await fastify.prisma.atendimento_mvp.update({
          where: { id: atendimento.id },
          data: { arquivos: arquivoPaths },
        })
      }

      if (audioFile) {
        audioPath = await saveBufferedAudio(atendimento.id, audioFile)
      }
    } catch (err) {
      fastify.log.error(err, 'Erro ao salvar arquivos')
      await fastify.prisma.atendimento_mvp.update({
        where: { id: atendimento.id },
        data: { status: 'erro' },
      })
      return reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: 'Erro ao salvar arquivos',
        atendimento_id: atendimento.id,
      })
    }

    reply.status(HttpStatus.ACCEPTED).send({
      atendimento_id: atendimento.id,
      status: 'processando',
    })

    const processInBackground = async () => {
      try {
        let transcricao = ''
        if (audioPath) {
          transcricao = await transcribeAudio(audioPath)
        }

        const fileResults = await processFiles(arquivoPaths)
        const conteudoArquivos = fileResults.map(r => `[${r.filename}]\n${r.text}`)

        const partes: string[] = []
        if (observacoes) partes.push(`Observações do médico:\n${observacoes}`)
        if (transcricao) partes.push(`Transcrição do áudio:\n${transcricao}`)
        if (conteudoArquivos.length > 0) partes.push(`Conteúdo dos arquivos:\n${conteudoArquivos.join('\n\n---\n\n')}`)
        if (paciente_nome) partes.push(`Nome do paciente: ${paciente_nome}`)

        const contexto = partes.join('\n\n')

        const resultado = await runAgents({
          contexto,
          consulta_anterior: consulta_anterior ?? '',
        })

        await fastify.prisma.atendimento_mvp.update({
          where: { id: atendimento.id },
          data: {
            prontuario: resultado,
            status: 'concluido',
            data_fim: new Date(),
          },
        })

        fastify.log.info({ atendimento_id: atendimento.id }, 'Atendimento processado com sucesso')
      } catch (err) {
        fastify.log.error(
          { err: errorMessage(err), atendimento_id: atendimento.id },
          'Erro ao processar atendimento em background',
        )
        await fastify.prisma.atendimento_mvp.update({
          where: { id: atendimento.id },
          data: { status: 'erro' },
        }).catch((dbErr: unknown) => {
          fastify.log.error(
            { err: errorMessage(dbErr), atendimento_id: atendimento.id },
            'Erro ao atualizar status para erro no banco',
          )
        })
      }
    }

    processInBackground()
  })

  fastify.get('/atendimento/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    let atendimento
    try {
      atendimento = await fastify.prisma.atendimento_mvp.findUnique({
        where: { id },
      })
    } catch (err) {
      fastify.log.error({ err, atendimento_id: id }, 'Erro ao buscar atendimento')
      throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, 'Erro ao buscar atendimento')
    }

    if (!atendimento) {
      return reply.status(HttpStatus.NOT_FOUND).send({ error: 'Atendimento não encontrado' })
    }

    return { status: atendimento.status, prontuario: atendimento.prontuario }
  })
}
