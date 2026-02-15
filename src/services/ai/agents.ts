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
import { SYSTEM_PROMPT as NON_LAB_EXAMS } from './prompts/11-non-laboratorial-exams.js'

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
  'Exames Não Laboratoriais',
  'Extrair Sentimentos',
  'Extrair Sono',
  'Evolução',
  'Resumo Histórico',
  'Resumo Clínico',
]

export async function runAgents(input: AgentsInput): Promise<string> {
  const { contexto, consulta_anterior } = input

  const historicoEConsulta = consulta_anterior + '\n\n--- Dados da Consulta Atual ---\n\n' + contexto

  // Phase 1: run all agents in parallel (except Clinical Summary)
  const settled = await Promise.allSettled([
    chatCompletion(EXTRACT_DRUGS, contexto),
    chatCompletion(ANALYZE_NUTRITION, contexto),
    chatCompletion(EXTRACT_EXERCISE, contexto),
    chatCompletion(BODY_COMPOSITION, historicoEConsulta),
    chatCompletion(LABORATORY_EXAMS, historicoEConsulta),
    chatCompletion(NON_LAB_EXAMS, contexto),
    chatCompletion(EXTRACT_FEELINGS, contexto),
    chatCompletion(EXTRACT_SLEEP, contexto),
    chatCompletion(EVOLUTION, contexto),
    chatCompletion(SUMMARIZE_HISTORY, consulta_anterior),
  ])

  const phase1Results = settled.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    console.error(`Agente "${AGENT_NAMES[i]}" falhou:`, errorMessage(result.reason))
    return ''
  })

  // Phase 2: Clinical Summary receives context + Summarize History output
  const [drugs, nutrition, exercise, body, labExams, nonLabExams, feelings, sleep, evolution, historySum] = phase1Results

  let clinicalSummary = ''
  try {
    const summaryInput = contexto + (historySum ? '\n\n--- Resumo Histórico ---\n\n' + historySum : '')
    clinicalSummary = await chatCompletion(CLINICAL_SUMMARY, summaryInput)
  } catch (err) {
    console.error(`Agente "${AGENT_NAMES[10]}" falhou:`, errorMessage(err))
  }

  const allResults = [...phase1Results, clinicalSummary]

  if (allResults.every(r => r === '')) {
    throw new AppError(HttpStatus.BAD_GATEWAY, 'Todos os agentes de IA falharam')
  }

  return [
    historySum, nutrition, exercise, drugs,
    body, labExams, nonLabExams, feelings,
    sleep, evolution, clinicalSummary,
  ].join('\n\n')
}
