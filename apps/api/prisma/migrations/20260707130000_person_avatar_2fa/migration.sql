-- Person: Avatar + 2FA-Felder. Rein additiv, alle Bestandszeilen bekommen
-- NULL/false-Defaults, kein Risiko fuer vorhandene Daten.
ALTER TABLE "Person" ADD COLUMN "avatarColor" TEXT;
ALTER TABLE "Person" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Person" ADD COLUMN "zweiFaktorAktiv" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Person" ADD COLUMN "zweiFaktorSecret" TEXT;

CREATE TABLE "ZweiFaktorBackupCode" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "benutztAm" DATE,

    CONSTRAINT "ZweiFaktorBackupCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ZweiFaktorBackupCode_personId_idx" ON "ZweiFaktorBackupCode"("personId");

ALTER TABLE "ZweiFaktorBackupCode" ADD CONSTRAINT "ZweiFaktorBackupCode_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
