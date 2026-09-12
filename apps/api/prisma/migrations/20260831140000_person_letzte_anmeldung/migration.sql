-- Tag der letzten erfolgreichen Anmeldung je Person.
--
-- ADDITIV und nullable: bestehende Instanzen laufen unverändert weiter, alle
-- vorhandenen Zeilen bleiben unangetastet (NULL = "noch nie gemessen").
--
-- Einziger Zweck ist der Zählwert `letzteAnmeldungAm` des internen
-- Kennzahlen-Endpunkts; dort wird ausschliesslich das MAXIMUM ueber alle
-- Personen ausgegeben, niemals ein Personenbezug.
ALTER TABLE "Person" ADD COLUMN "letzteAnmeldungAm" DATE;
