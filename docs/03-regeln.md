# Validierungs- & Geschäftsregeln

## Rollen & Berechtigungen
- Jede Person ist mindestens Teilhabender (mind. 1 aktive Mitgliedschaft).
- Software-Rollen einer Person: {Teilhabender} plus optional {Protokollführer}
  und/oder {Admin}. Mehr Software-Rollen gibt es nicht.
- Lesen: jede angemeldete, aktive Person darf ALLES in ALLEN Domänen lesen.
- Schreiben (Vorschlag/Bedenken/Einwand/Beschluss anlegen): nur wer in DIESEM
  Kreis eine gültige Logbuchführer-Rolle hat (= Protokollführer).
- Personen anlegen/löschen: nur Admin. Korrekturanträge bestätigen: nur Admin.

## Kreis-Gründung (Regel a)
Ein neuer Kreis (auch Hilfs-/Projektkreis) braucht bei Gründung mindestens
3 Mitglieder mit den Rollen: 1× Moderation, 1× Logbuchführer, 1× Teilhabender.
Ohne diese Besetzung ist das Anlegen nicht möglich.

## Kreis-Verschachtelung (Regel a2)
Der Domänen-Baum hat höchstens drei Ebenen: Hauptdomäne (Ebene 0) →
Unterdomäne (Ebene 1) → Unter-Unterdomäne (Ebene 2). Es gibt beliebig viele
Haupt- und Unterdomänen, aber je Unterdomäne höchstens 3 Unter-Unterdomänen
(`MAX_UNTER_UNTER_DOMAENEN`, aus Gründen der Darstellbarkeit; archivierte zählen
nicht mit). Eine vierte Ebene ist ausgeschlossen. Serverseitig erzwungen beim
Anlegen (`DomaeneService.erstellenMit`), clientseitig als Komfort im Eltern-
Auswahlfeld (`DomaeneModal`).

## Kreis-Löschung (Regel b)
Beim Löschen eines Kreises prüfen: Verliert dadurch eine Person ihre LETZTE
Mitgliedschaft/Rolle (steht danach ohne Kreis, Domäne und Zuweisung da)?
- Falls ja, pro betroffener Person Auswahl anbieten:
  (1) Person ebenfalls löschen (Zugang entziehen) ODER
  (2) Person in einem anderen, bestehenden Kreis behalten (dort mind.
      Teilhabender machen).
- Sonderfall reiner Teilhabender ohne weitere Rolle fällt genau hierunter.

## Vorgang: Vorschlag → Bedenken/Einwände → Integration → Beschluss (Regel c-Basis)
- Ein Vorschlag wird mit governanceTyp (governance|operativ) angelegt (Pflicht).
- Vor dem Speichern eines Beschlusses können beliebig viele Bedenken und
  Einwände eingetragen werden.
- Leichter Einwand: Integration ODER Notiz zum Beschluss optional.
- Schwerwiegender Einwand: Integration als Text PFLICHT, bevor das Beschlussfeld
  gespeichert werden darf. (Serverseitig erzwingen, nicht nur im UI.)
- Beschluss: befristet ⇒ ueberpruefungsdatum Pflicht (Evaluationspflicht +
  Benachrichtigung an Teilhabende der Domäne). Unbefristet ⇒ keine Evaluation,
  nur durch neuen Beschluss änderbar.
- Vorschlag ohne Beschluss bleibt "offen" (Anzeige blau). Mit Beschluss:
  "entschieden" (Beschluss grün).

## Korrektur (Regel c)
- Einträge sind nach dem Speichern unveränderlich.
- Im UI hat jeder Vorschlag ein Modal mit seinen Feldern; wird ein Feld
  geändert, erscheint der Button „Korrektur beantragen".
- Ein Korrekturantrag benachrichtigt ALLE Admins. Bestätigt mindestens EIN
  Admin, wird der neue Inhalt übernommen.
- Nebenläufigkeit: Bestätigen zwei Admins denselben Antrag gleichzeitig, gilt
  nur die erste Bestätigung (Statuswechsel offen→bestaetigt atomar).
- Änderungslog: für ALLE Teilhabenden an einer Stelle lesbar; zeigt je Änderung
  welcher Protokollführer beantragt und welcher Admin wann bestätigt hat.
  (Wird als Leseansicht aus bestätigten Korrekturanträgen erzeugt.)

## Farbcodierung (Anzeige)
Vorschlag = blau, Bedenken = gelb, leichter Einwand = hellrot,
schwerwiegender Einwand = dunkelrot, Beschluss = grün.
(Ergibt sich aus Typ/Schweregrad/Status, ist kein eigenes Feld.)
