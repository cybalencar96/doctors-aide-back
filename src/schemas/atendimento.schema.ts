import { z } from 'zod'

export const processarAtendimentoSchema = z.object({
  paciente_id: z.string().uuid('ID do paciente inválido'),
  texto_historico: z.string().optional(),
  texto_consulta_atual: z.string().optional(),
})

export type ProcessarAtendimentoInput = z.infer<typeof processarAtendimentoSchema>
