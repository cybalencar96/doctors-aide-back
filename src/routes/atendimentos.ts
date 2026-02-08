import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { processarAtendimentoSchema } from '../schemas/atendimento.schema.js'
import { saveFiles, saveAudio, readFileContent } from '../services/storage.service.js'
import { transcribeAudio } from '../services/ai/ai-client.js'
import { runAgents } from '../services/ai/agents.js'

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
    const parts = request.parts()
    const fields: Record<string, string> = {}
    const arquivoFiles: MultipartFile[] = []
    let audioFile: MultipartFile | null = null

    for await (const part of parts) {
      if (part.type === 'field') {
        fields[part.fieldname] = part.value as string
      } else if (part.type === 'file') {
        if (part.fieldname === 'audio') {
          audioFile = part
        } else {
          arquivoFiles.push(part)
        }
      }
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
      },
    })

    try {
      // 2. Salva arquivos + áudio no disco
      let arquivoPaths: string[] = []
      let audioPath: string | null = null

      if (arquivoFiles.length > 0) {
        arquivoPaths = await saveFiles(atendimento.id, arquivoFiles)
        await fastify.prisma.atendimento_mvp.update({
          where: { id: atendimento.id },
          data: { arquivos: arquivoPaths },
        })
      }

      if (audioFile) {
        audioPath = await saveAudio(atendimento.id, audioFile)
      }

      // 3. Transcreve áudio
      let transcricao = ''
      if (audioPath) {
        transcricao = await transcribeAudio(audioPath)
      }

      // 4. Lê conteúdo dos arquivos
      const conteudoArquivos: string[] = []
      for (const filePath of arquivoPaths) {
        try {
          const content = await readFileContent(filePath)
          conteudoArquivos.push(content)
        } catch {
          // Arquivo binário ou ilegível — ignora
        }
      }

      // 5. Monta contexto
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

      // 6-8. Roda agentes e concatena resultado
      const resultado = await runAgents({
        contexto,
        consulta_anterior: consulta_anterior ?? '',
      })

      // 9. Salva no banco
      const updated = await fastify.prisma.atendimento_mvp.update({
        where: { id: atendimento.id },
        data: {
          prontuario: resultado,
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

      fastify.log.error(err, 'Erro ao processar atendimento')
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
