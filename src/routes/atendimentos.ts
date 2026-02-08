import type { FastifyInstance } from 'fastify'
import { processarAtendimentoSchema } from '../schemas/atendimento.schema.js'
import { saveBufferedFiles, saveBufferedAudio, readFileContent } from '../services/storage.service.js'
import { transcribeAudio } from '../services/ai/ai-client.js'
import { runAgents } from '../services/ai/agents.js'

interface BufferedFile {
  buffer: Buffer
  filename: string
}

export default async function atendimentosRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/medico/:id/atendimentos', async (request, reply) => {
    const { id } = request.params as { id: string }

    const atendimentos = await fastify.prisma.atendimento_mvp.findMany({
      where: { medico_id: id },
      orderBy: { data_inicio: 'desc' },
      include: { paciente: true },
    })

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
      return reply.status(413).send({
        error: 'Erro no upload dos arquivos. Verifique o tamanho máximo (50 MB por arquivo, 10 arquivos).',
      })
    }

    const parsed = processarAtendimentoSchema.safeParse(fields)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() })
    }

    const user = request.user
    const { paciente_id, paciente_nome, consulta_anterior, observacoes } = parsed.data

    // 1. Cria atendimento no banco
    const atendimento = await fastify.prisma.atendimento_mvp.create({
      data: {
        medico_id: user.medico_id,
        paciente_id,
        texto_consulta_atual: observacoes,
        texto_historico: consulta_anterior,
        arquivos: [],
        status: 'processando',
      },
    })

    // 2. Salva arquivos + áudio no disco (antes de responder, pois o stream precisa ser consumido)
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
      return reply.status(500).send({
        error: 'Erro ao salvar arquivos',
        atendimento_id: atendimento.id,
      })
    }

    // 3. Responde imediatamente — processamento dos agentes de IA ocorre em background
    reply.status(202).send({
      atendimento_id: atendimento.id,
      status: 'processando',
    })

    // 4. Processamento assíncrono em background
    const processInBackground = async () => {
      try {
        // Transcreve áudio
        let transcricao = ''
        if (audioPath) {
          transcricao = await transcribeAudio(audioPath)
        }

        // Lê conteúdo dos arquivos
        const conteudoArquivos: string[] = []
        for (const filePath of arquivoPaths) {
          try {
            const content = await readFileContent(filePath)
            conteudoArquivos.push(content)
          } catch {
            // Arquivo binário ou ilegível — ignora
          }
        }

        // Monta contexto
        const partes: string[] = []

        if (observacoes) {
          partes.push(`Observações do médico:\n${observacoes}`)
        }
        if (transcricao) {
          partes.push(`Transcrição do áudio:\n${transcricao}`)
        }
        if (conteudoArquivos.length > 0) {
          partes.push(`Conteúdo dos arquivos:\n${conteudoArquivos.join('\n\n---\n\n')}`)
        }
        if (paciente_nome) {
          partes.push(`Nome do paciente: ${paciente_nome}`)
        }

        const contexto = partes.join('\n\n')

        // Roda agentes e concatena resultado
        const resultado = await runAgents({
          contexto,
          consulta_anterior: consulta_anterior ?? '',
        })

        // Salva no banco
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
        fastify.log.error(err, 'Erro ao processar atendimento em background')
        await fastify.prisma.atendimento_mvp.update({
          where: { id: atendimento.id },
          data: { status: 'erro' },
        }).catch((dbErr) => {
          fastify.log.error(dbErr, 'Erro ao atualizar status para erro')
        })
      }
    }

    processInBackground()
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
