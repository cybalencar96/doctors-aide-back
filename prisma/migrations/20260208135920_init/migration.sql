-- CreateTable
CREATE TABLE "medico" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "crm" TEXT NOT NULL,
    "uf_crm" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" TEXT NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "data_nascimento" TIMESTAMP(3) NOT NULL,
    "sexo" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_mvp" (
    "id" TEXT NOT NULL,
    "medico_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "texto_historico" TEXT,
    "texto_consulta_atual" TEXT,
    "status" TEXT NOT NULL DEFAULT 'em_processamento',
    "prontuario" TEXT,
    "data_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMP(3),
    "arquivos" TEXT[],

    CONSTRAINT "atendimento_mvp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medico_crm_uf_crm_key" ON "medico"("crm", "uf_crm");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cpf_key" ON "paciente"("cpf");

-- AddForeignKey
ALTER TABLE "atendimento_mvp" ADD CONSTRAINT "atendimento_mvp_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_mvp" ADD CONSTRAINT "atendimento_mvp_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
