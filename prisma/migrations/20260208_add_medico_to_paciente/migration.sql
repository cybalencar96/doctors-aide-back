-- DropIndex
DROP INDEX IF EXISTS "paciente_cpf_key";

-- AlterTable
ALTER TABLE "paciente" ADD COLUMN "medico_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cpf_medico_id_key" ON "paciente"("cpf", "medico_id");
