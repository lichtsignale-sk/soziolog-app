-- Domaene-Kernfelder bereinigen: das alte, von "name"/"ziel" unabhaengige
-- Freitextfeld "domaene" (z. B. "Koordination", "Gesamt") entfaellt ersatzlos --
-- es hat im neuen Domaenen-Modell keine Entsprechung mehr (Name/Ziel/Aufgaben
-- sind die drei fachlichen Kernfelder). Vorhandene Werte gehen verloren
-- (vom Nutzer ausdruecklich bestaetigt).
ALTER TABLE "Domaene" DROP COLUMN "domaene";

-- Domaenenaufgaben (max. 10, mind. 1 bei Neuanlage/Bearbeitung -- serverseitig
-- per DTO-Validierung erzwungen, nicht rueckwirkend auf Bestandsdaten).
ALTER TABLE "Domaene" ADD COLUMN "tasks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
