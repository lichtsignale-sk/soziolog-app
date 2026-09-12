-- Neufassung: Vorschlag kann als Ablösung eines bestehenden Beschlusses markiert
-- werden (ersetztBeschlussId). Additiv, nullable, mit Unique-Index und FK auf
-- Beschluss (SET NULL, falls der abgelöste Beschluss je entfernt würde).
ALTER TABLE "Vorschlag" ADD COLUMN "ersetztBeschlussId" TEXT;

CREATE UNIQUE INDEX "Vorschlag_ersetztBeschlussId_key" ON "Vorschlag"("ersetztBeschlussId");

ALTER TABLE "Vorschlag" ADD CONSTRAINT "Vorschlag_ersetztBeschlussId_fkey" FOREIGN KEY ("ersetztBeschlussId") REFERENCES "Beschluss"("id") ON DELETE SET NULL ON UPDATE CASCADE;
