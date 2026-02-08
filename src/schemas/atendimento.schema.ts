import { z } from 'zod'

export const processarAtendimentoSchema = z.object({
  paciente_id: z.string().uuid('ID do paciente inválido'),
  paciente_nome: z.string().min(1, 'Nome do paciente é obrigatório'),
  consulta_anterior: z.string().optional(),
  observacoes: z.string().optional(),
})

export type ProcessarAtendimentoInput = z.infer<typeof processarAtendimentoSchema>
