-- CreateIndex
CREATE INDEX "Beschluss_gueltigAb_idx" ON "Beschluss"("gueltigAb");

-- CreateIndex
CREATE INDEX "Beschluss_gueltigBis_idx" ON "Beschluss"("gueltigBis");

-- CreateIndex
CREATE INDEX "Beschluss_gueltigkeitStatus_idx" ON "Beschluss"("gueltigkeitStatus");

-- CreateIndex
CREATE INDEX "Vorschlag_kreisId_datum_idx" ON "Vorschlag"("kreisId", "datum");
