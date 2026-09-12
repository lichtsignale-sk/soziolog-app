-- Entfernt die denormalisierten Anzeige-Zähler. Alle Zahlen (Beschlüsse,
-- Nutzer/Teilhabende, Bedenken/Einwände) werden nun live aus den echten
-- Datensätzen aggregiert.
ALTER TABLE "Domaene"
  DROP COLUMN "anzahlBeschluesse",
  DROP COLUMN "anzahlOffen",
  DROP COLUMN "anzahlNutzer",
  DROP COLUMN "anzahlBedenken",
  DROP COLUMN "anzahlEinwaende";

ALTER TABLE "Organisation"
  DROP COLUMN "bedenkenProMonat";
