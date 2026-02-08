import { z } from 'zod'

export const loginSchema = z.object({
  crm: z.string().min(1, 'CRM é obrigatório'),
  uf_crm: z.string().length(2, 'UF deve ter 2 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>
