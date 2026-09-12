-- CreateEnum
CREATE TYPE "GovernanceTyp" AS ENUM ('governance', 'operativ');

-- CreateEnum
CREATE TYPE "VorschlagStatus" AS ENUM ('offen', 'entschieden', 'zurueckgezogen');

-- CreateEnum
CREATE TYPE "EinwandSchweregrad" AS ENUM ('leicht', 'schwerwiegend');

-- CreateEnum
CREATE TYPE "Befristung" AS ENUM ('befristet', 'unbefristet');

-- CreateEnum
CREATE TYPE "GueltigkeitStatus" AS ENUM ('gueltig', 'in_ueberpruefung', 'ersetzt', 'beendet');

-- CreateEnum
CREATE TYPE "KreisTyp" AS ENUM ('dauerkreis', 'hilfskreis');

-- CreateEnum
CREATE TYPE "RolleTyp" AS ENUM ('moderation', 'logbuchfuehrer', 'kreisleitung', 'delegierte');

-- CreateEnum
CREATE TYPE "EinladungStatus" AS ENUM ('offen', 'eingeloest', 'abgelaufen');

-- CreateEnum
CREATE TYPE "KorrekturZielTyp" AS ENUM ('vorschlag', 'bedenken', 'einwand', 'beschluss');

-- CreateEnum
CREATE TYPE "KorrekturStatus" AS ENUM ('offen', 'bestaetigt', 'abgelehnt');

-- CreateEnum
CREATE TYPE "BenachrichtigungTyp" AS ENUM ('ueberpruefung_faellig', 'korrektur_beantragt', 'korrektur_bestaetigt', 'korrektur_abgelehnt');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "einwaendeAnonym" BOOLEAN NOT NULL DEFAULT true,
    "handlungenRollenbasiert" BOOLEAN NOT NULL DEFAULT true,
    "setupAbgeschlossen" BOOLEAN NOT NULL DEFAULT false,
    "angelegtAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nutzername" TEXT NOT NULL,
    "loginEmail" TEXT NOT NULL,
    "passwortHash" TEXT,
    "istAdmin" BOOLEAN NOT NULL DEFAULT false,
    "benachrichtigungenAktiv" BOOLEAN NOT NULL DEFAULT true,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "angelegtAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Einladung" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "laeuftAbAm" DATE NOT NULL,
    "eingeloestAm" DATE,
    "status" "EinladungStatus" NOT NULL DEFAULT 'offen',

    CONSTRAINT "Einladung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kreis" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "elternKreisId" TEXT,
    "name" TEXT NOT NULL,
    "ziel" TEXT NOT NULL,
    "domaene" TEXT NOT NULL,
    "typ" "KreisTyp" NOT NULL DEFAULT 'dauerkreis',
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "gegruendetAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aufgeloestAm" DATE,

    CONSTRAINT "Kreis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mitgliedschaft" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kreisId" TEXT NOT NULL,
    "gueltigAb" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigBis" DATE,

    CONSTRAINT "Mitgliedschaft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rollenzuweisung" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kreisId" TEXT NOT NULL,
    "rolleTyp" "RolleTyp" NOT NULL,
    "gueltigAb" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigBis" DATE,

    CONSTRAINT "Rollenzuweisung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sitzung" (
    "id" TEXT NOT NULL,
    "kreisId" TEXT NOT NULL,
    "datum" DATE NOT NULL,
    "titel" TEXT,
    "notiz" TEXT,

    CONSTRAINT "Sitzung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vorschlag" (
    "id" TEXT NOT NULL,
    "kreisId" TEXT NOT NULL,
    "sitzungId" TEXT,
    "erfasstVonId" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "governanceTyp" "GovernanceTyp" NOT NULL,
    "status" "VorschlagStatus" NOT NULL DEFAULT 'offen',
    "datum" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vorschlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bedenken" (
    "id" TEXT NOT NULL,
    "vorschlagId" TEXT NOT NULL,
    "erfasstVonId" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "datum" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bedenken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Einwand" (
    "id" TEXT NOT NULL,
    "vorschlagId" TEXT NOT NULL,
    "erfasstVonId" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "schweregrad" "EinwandSchweregrad" NOT NULL,
    "integration" TEXT,
    "datum" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Einwand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beschluss" (
    "id" TEXT NOT NULL,
    "vorschlagId" TEXT NOT NULL,
    "ersetztBeschlussId" TEXT,
    "erfasstVonId" TEXT NOT NULL,
    "inhalt" TEXT NOT NULL,
    "notiz" TEXT,
    "befristung" "Befristung" NOT NULL,
    "ueberpruefungsdatum" DATE,
    "gueltigkeitStatus" "GueltigkeitStatus" NOT NULL DEFAULT 'gueltig',
    "gueltigAb" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigBis" DATE,
    "datum" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Beschluss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Korrekturantrag" (
    "id" TEXT NOT NULL,
    "zielTyp" "KorrekturZielTyp" NOT NULL,
    "zielId" TEXT NOT NULL,
    "feld" TEXT NOT NULL,
    "alterInhalt" TEXT NOT NULL,
    "neuerInhalt" TEXT NOT NULL,
    "begruendung" TEXT,
    "beantragtVonId" TEXT NOT NULL,
    "bestaetigtVonId" TEXT,
    "status" "KorrekturStatus" NOT NULL DEFAULT 'offen',
    "beantragtAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entschiedenAm" DATE,

    CONSTRAINT "Korrekturantrag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benachrichtigung" (
    "id" TEXT NOT NULL,
    "typ" "BenachrichtigungTyp" NOT NULL,
    "betrifftBeschlussId" TEXT,
    "betrifftKorrekturId" TEXT,
    "kreisId" TEXT,
    "inhalt" TEXT NOT NULL,
    "faelligAm" DATE,
    "erstelltAm" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Benachrichtigung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenachrichtigungEmpfang" (
    "id" TEXT NOT NULL,
    "benachrichtigungId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "gelesen" BOOLEAN NOT NULL DEFAULT false,
    "gelesenAm" DATE,
    "perEmailGesendet" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BenachrichtigungEmpfang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_nutzername_key" ON "Person"("nutzername");

-- CreateIndex
CREATE UNIQUE INDEX "Person_loginEmail_key" ON "Person"("loginEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Einladung_personId_key" ON "Einladung"("personId");

-- CreateIndex
CREATE INDEX "Mitgliedschaft_personId_idx" ON "Mitgliedschaft"("personId");

-- CreateIndex
CREATE INDEX "Mitgliedschaft_kreisId_idx" ON "Mitgliedschaft"("kreisId");

-- CreateIndex
CREATE INDEX "Rollenzuweisung_personId_idx" ON "Rollenzuweisung"("personId");

-- CreateIndex
CREATE INDEX "Rollenzuweisung_kreisId_idx" ON "Rollenzuweisung"("kreisId");

-- CreateIndex
CREATE UNIQUE INDEX "Beschluss_vorschlagId_key" ON "Beschluss"("vorschlagId");

-- CreateIndex
CREATE UNIQUE INDEX "Beschluss_ersetztBeschlussId_key" ON "Beschluss"("ersetztBeschlussId");

-- CreateIndex
CREATE UNIQUE INDEX "BenachrichtigungEmpfang_benachrichtigungId_personId_key" ON "BenachrichtigungEmpfang"("benachrichtigungId", "personId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Einladung" ADD CONSTRAINT "Einladung_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kreis" ADD CONSTRAINT "Kreis_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kreis" ADD CONSTRAINT "Kreis_elternKreisId_fkey" FOREIGN KEY ("elternKreisId") REFERENCES "Kreis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mitgliedschaft" ADD CONSTRAINT "Mitgliedschaft_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mitgliedschaft" ADD CONSTRAINT "Mitgliedschaft_kreisId_fkey" FOREIGN KEY ("kreisId") REFERENCES "Kreis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rollenzuweisung" ADD CONSTRAINT "Rollenzuweisung_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rollenzuweisung" ADD CONSTRAINT "Rollenzuweisung_kreisId_fkey" FOREIGN KEY ("kreisId") REFERENCES "Kreis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitzung" ADD CONSTRAINT "Sitzung_kreisId_fkey" FOREIGN KEY ("kreisId") REFERENCES "Kreis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vorschlag" ADD CONSTRAINT "Vorschlag_kreisId_fkey" FOREIGN KEY ("kreisId") REFERENCES "Kreis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vorschlag" ADD CONSTRAINT "Vorschlag_sitzungId_fkey" FOREIGN KEY ("sitzungId") REFERENCES "Sitzung"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vorschlag" ADD CONSTRAINT "Vorschlag_erfasstVonId_fkey" FOREIGN KEY ("erfasstVonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bedenken" ADD CONSTRAINT "Bedenken_vorschlagId_fkey" FOREIGN KEY ("vorschlagId") REFERENCES "Vorschlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bedenken" ADD CONSTRAINT "Bedenken_erfasstVonId_fkey" FOREIGN KEY ("erfasstVonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Einwand" ADD CONSTRAINT "Einwand_vorschlagId_fkey" FOREIGN KEY ("vorschlagId") REFERENCES "Vorschlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Einwand" ADD CONSTRAINT "Einwand_erfasstVonId_fkey" FOREIGN KEY ("erfasstVonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beschluss" ADD CONSTRAINT "Beschluss_vorschlagId_fkey" FOREIGN KEY ("vorschlagId") REFERENCES "Vorschlag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beschluss" ADD CONSTRAINT "Beschluss_ersetztBeschlussId_fkey" FOREIGN KEY ("ersetztBeschlussId") REFERENCES "Beschluss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beschluss" ADD CONSTRAINT "Beschluss_erfasstVonId_fkey" FOREIGN KEY ("erfasstVonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Korrekturantrag" ADD CONSTRAINT "Korrekturantrag_beantragtVonId_fkey" FOREIGN KEY ("beantragtVonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Korrekturantrag" ADD CONSTRAINT "Korrekturantrag_bestaetigtVonId_fkey" FOREIGN KEY ("bestaetigtVonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benachrichtigung" ADD CONSTRAINT "Benachrichtigung_betrifftBeschlussId_fkey" FOREIGN KEY ("betrifftBeschlussId") REFERENCES "Beschluss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benachrichtigung" ADD CONSTRAINT "Benachrichtigung_betrifftKorrekturId_fkey" FOREIGN KEY ("betrifftKorrekturId") REFERENCES "Korrekturantrag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benachrichtigung" ADD CONSTRAINT "Benachrichtigung_kreisId_fkey" FOREIGN KEY ("kreisId") REFERENCES "Kreis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenachrichtigungEmpfang" ADD CONSTRAINT "BenachrichtigungEmpfang_benachrichtigungId_fkey" FOREIGN KEY ("benachrichtigungId") REFERENCES "Benachrichtigung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenachrichtigungEmpfang" ADD CONSTRAINT "BenachrichtigungEmpfang_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
