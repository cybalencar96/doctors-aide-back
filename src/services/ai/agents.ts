import { chatCompletion } from './ai-client.js'
import { AppError, HttpStatus, errorMessage } from '../../errors.js'
import { SYSTEM_PROMPT as EXTRACT_DRUGS } from './prompts/01-extract-drugs.js'
import { SYSTEM_PROMPT as ANALYZE_NUTRITION } from './prompts/02-analyze-nutrition.js'
import { SYSTEM_PROMPT as EXTRACT_EXERCISE } from './prompts/03-extract-exercise.js'
import { SYSTEM_PROMPT as BODY_COMPOSITION } from './prompts/04-calculate-body-composition.js'
import { SYSTEM_PROMPT as LABORATORY_EXAMS } from './prompts/05-process-laboratory-exams.js'
import { SYSTEM_PROMPT as EXTRACT_FEELINGS } from './prompts/06-extract-feelings.js'
import { SYSTEM_PROMPT as EXTRACT_SLEEP } from './prompts/07-extract-sleep-data.js'
import { SYSTEM_PROMPT as EVOLUTION } from './prompts/08-evolution.js'
import { SYSTEM_PROMPT as SUMMARIZE_HISTORY } from './prompts/09-summarize-medical-history.js'
import { SYSTEM_PROMPT as CLINICAL_SUMMARY } from './prompts/10-generate-clinical-summary.js'

export interface AgentsInput {
  contexto: string
  consulta_anterior: string
}

const AGENT_NAMES = [
  'Extrair Medicamentos',
  'Analisar Nutrição',
  'Extrair Exercícios',
  'Composição Corporal',
  'Exames Laboratoriais',
  'Extrair Sentimentos',
  'Extrair Sono',
  'Evolução',
  'Resumo Histórico',
]

export async function runAgents(input: AgentsInput): Promise<string> {
  const { contexto, consulta_anterior } = input

  const settled = await Promise.allSettled([
    chatCompletion(EXTRACT_DRUGS, contexto),
    chatCompletion(ANALYZE_NUTRITION, contexto),
    chatCompletion(EXTRACT_EXERCISE, contexto),
    chatCompletion(BODY_COMPOSITION, contexto),
    chatCompletion(LABORATORY_EXAMS, contexto),
    chatCompletion(EXTRACT_FEELINGS, contexto),
    chatCompletion(EXTRACT_SLEEP, contexto),
    chatCompletion(EVOLUTION, contexto),
    chatCompletion(SUMMARIZE_HISTORY, consulta_anterior),
  ])

  const results = settled.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    console.error(`Agente "${AGENT_NAMES[i]}" falhou:`, errorMessage(result.reason))
    return ''
  })

  if (results.every(r => r === '')) {
    throw new AppError(HttpStatus.BAD_GATEWAY, 'Todos os agentes de IA falharam')
  }

  const [agent1, agent2, agent3, agent4, agent5, agent6, agent7, agent8, agent9] = results

  let agent10 = ''
  try {
    const agent10Input = [contexto, '\n\n--- Resumo do Histórico ---\n\n', agent9].join('')
    agent10 = await chatCompletion(CLINICAL_SUMMARY, agent10Input)
  } catch (err) {
    console.error('Agente "Resumo Clínico" falhou:', errorMessage(err))
  }

  return [
    agent9, agent2, agent3, agent1,
    agent4, agent5, agent6, agent7,
    agent8, agent10,
  ].join('\n\n')
}
