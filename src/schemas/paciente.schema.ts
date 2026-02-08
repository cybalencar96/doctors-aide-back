import { z } from 'zod'

export const cadastrarPacienteSchema = z.object({
  nome_completo: z.string().min(1, 'Nome completo é obrigatório'),
  cpf: z.string().length(11, 'CPF deve ter 11 dígitos'),
  data_nascimento: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Data de nascimento inválida',
  }),
  sexo: z.string().min(1, 'Sexo é obrigatório'),
  telefone: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
})

export type CadastrarPacienteInput = z.infer<typeof cadastrarPacienteSchema>
