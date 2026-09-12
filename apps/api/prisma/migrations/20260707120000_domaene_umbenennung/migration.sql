-- Kreis -> Domaene: reine Umbenennung (Tabelle, Spalten, Enum, Constraints, Indizes).
-- KEINE Drop/Create-Operationen -- alle Bestandsdaten bleiben erhalten.

-- Enum umbenennen + Werte anpassen (Dauerkreis/Hilfskreis -> Dauerdomaene/Arbeitsdomaene)
ALTER TYPE "KreisTyp" RENAME TO "DomaeneTyp";
ALTER TYPE "DomaeneTyp" RENAME VALUE 'dauerkreis' TO 'dauerdomaene';
ALTER TYPE "DomaeneTyp" RENAME VALUE 'hilfskreis' TO 'arbeitsdomaene';

-- RolleTyp: kreisleitung -> domaenenleitung (konsistent mit der Umbenennung)
ALTER TYPE "RolleTyp" RENAME VALUE 'kreisleitung' TO 'domaenenleitung';

-- Tabelle + Selbstreferenz umbenennen
ALTER TABLE "Kreis" RENAME TO "Domaene";
ALTER TABLE "Domaene" RENAME COLUMN "elternKreisId" TO "elternDomaeneId";

-- Fremdschluessel-Spalten auf den abhaengigen Tabellen umbenennen
ALTER TABLE "Mitgliedschaft" RENAME COLUMN "kreisId" TO "domaeneId";
ALTER TABLE "Rollenzuweisung" RENAME COLUMN "kreisId" TO "domaeneId";
ALTER TABLE "Vorschlag" RENAME COLUMN "kreisId" TO "domaeneId";
ALTER TABLE "Sitzung" RENAME COLUMN "kreisId" TO "domaeneId";
ALTER TABLE "Benachrichtigung" RENAME COLUMN "kreisId" TO "domaeneId";

-- Primary-Key-Constraint-Name folgt der Tabelle automatisch nicht -- explizit umbenennen
ALTER TABLE "Domaene" RENAME CONSTRAINT "Kreis_pkey" TO "Domaene_pkey";

-- Foreign-Key-Constraints umbenennen
ALTER TABLE "Domaene" RENAME CONSTRAINT "Kreis_organisationId_fkey" TO "Domaene_organisationId_fkey";
ALTER TABLE "Domaene" RENAME CONSTRAINT "Kreis_elternKreisId_fkey" TO "Domaene_elternDomaeneId_fkey";
ALTER TABLE "Mitgliedschaft" RENAME CONSTRAINT "Mitgliedschaft_kreisId_fkey" TO "Mitgliedschaft_domaeneId_fkey";
ALTER TABLE "Rollenzuweisung" RENAME CONSTRAINT "Rollenzuweisung_kreisId_fkey" TO "Rollenzuweisung_domaeneId_fkey";
ALTER TABLE "Sitzung" RENAME CONSTRAINT "Sitzung_kreisId_fkey" TO "Sitzung_domaeneId_fkey";
ALTER TABLE "Vorschlag" RENAME CONSTRAINT "Vorschlag_kreisId_fkey" TO "Vorschlag_domaeneId_fkey";
ALTER TABLE "Benachrichtigung" RENAME CONSTRAINT "Benachrichtigung_kreisId_fkey" TO "Benachrichtigung_domaeneId_fkey";

-- Indizes umbenennen
ALTER INDEX "Mitgliedschaft_kreisId_idx" RENAME TO "Mitgliedschaft_domaeneId_idx";
ALTER INDEX "Rollenzuweisung_kreisId_idx" RENAME TO "Rollenzuweisung_domaeneId_idx";
ALTER INDEX "Vorschlag_kreisId_datum_idx" RENAME TO "Vorschlag_domaeneId_datum_idx";
