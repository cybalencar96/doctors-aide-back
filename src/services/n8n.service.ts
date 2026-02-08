interface ProcessarPayload {
  atendimento_id: string
  medico_id: string
  paciente_id: string
  texto_historico?: string
  texto_consulta_atual?: string
  arquivos: string[]
}

interface N8nResponse {
  prontuario_texto: string
}

export async function processarAtendimento(payload: ProcessarPayload): Promise<N8nResponse> {
  const n8nUrl = process.env.N8N_URL
  const n8nSecret = process.env.N8N_SECRET

  if (!n8nUrl) {
    throw new Error('N8N_URL não configurada')
  }

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(n8nSecret ? { Authorization: `Bearer ${n8nSecret}` } : {}),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Erro ao chamar n8n: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<N8nResponse>
}
