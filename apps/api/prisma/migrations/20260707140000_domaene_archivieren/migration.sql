-- Reversibles Archivieren ersetzt die bisherige einseitige Auflösung.
-- "aufgeloestAm" wird zu "archiviertAm"; neues Flag "archiviert". Bestehende
-- aufgeloeste Domaenen gelten als bereits archiviert (kein Informationsverlust).
ALTER TABLE "Domaene" RENAME COLUMN "aufgeloestAm" TO "archiviertAm";
ALTER TABLE "Domaene" ADD COLUMN "archiviert" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Domaene" SET "archiviert" = true WHERE "archiviertAm" IS NOT NULL;
