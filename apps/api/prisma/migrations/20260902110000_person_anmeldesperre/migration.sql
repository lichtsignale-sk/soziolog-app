-- Fehlversuchszaehler und Anmeldesperre je Konto.
--
-- Bis hierher gab es allein das IP-Rate-Limit von 5 Anmeldungen pro Minute. Das
-- begrenzt, wie oft EINE Adresse fragen darf, nicht wie oft AUF EIN KONTO
-- geraten wird: Mit wenigen Adressen waren mehrere tausend Versuche pro Tag auf
-- ein bekanntes Konto moeglich. docs/04-sicherheit.md verlangt Backoff.
--
-- Vorhandene Zeilen starten bei 0 und ohne Sperre.
ALTER TABLE "Person" ADD COLUMN "fehlversuche" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Person" ADD COLUMN "gesperrtBis" TIMESTAMP(3);
