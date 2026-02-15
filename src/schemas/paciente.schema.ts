import { z } from 'zod'

export const cadastrarPacienteSchema = z.object({
  nome_completo: z.string().min(1, 'Nome completo é obrigatório'),
  cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter apenas 11 dígitos numéricos'),
  data_nascimento: z.string().refine((val) => {
    const date = new Date(val)
    if (isNaN(date.getTime())) return false
    const year = date.getFullYear()
    return year >= 1900 && year <= new Date().getFullYear()
  }, {
    message: 'Data de nascimento inválida',
  }),
  sexo: z.string().min(1, 'Sexo é obrigatório'),
  telefone: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
})

export type CadastrarPacienteInput = z.infer<typeof cadastrarPacienteSchema>
