# Datenmodell (fachlich)

Die verbindliche technische Fassung ist das Prisma-Schema (siehe Schritt 3 des
Umsetzungsplans). Diese Datei beschreibt Bedeutung und Beziehungen.

## Entitäten
- **Organisation**: Klammer. Enthält Sichtbarkeits-Einstellungen und ein Flag
  setupAbgeschlossen.
- **Person**: Nutzer mit Name, Nutzername, E-Mail, Passwort-Hash, istAdmin,
  benachrichtigungenAktiv, aktiv.
- **Einladung**: Signierter Einmal-Token je Person zum Anlegen des Accounts.
- **Kreis** (Domäne): Baum über elternKreisId. typ = dauerkreis|hilfskreis.
  gegruendetAm/aufgeloestAm für korrekte Rückblicke.
- **Mitgliedschaft** (Person×Kreis): die "Teilhabender"-Basis, zeitlich gültig.
- **Rollenzuweisung** (Person×Kreis): soziokratische Funktionsrolle
  (moderation|logbuchfuehrer|kreisleitung|delegierte), zeitlich gültig.
- **Sitzung** (optional): Rahmen-Einheit, bündelt Vorschläge eines Tages in
  einem Kreis. Für das Log nicht zwingend sichtbar.
- **Vorschlag**: Anker eines Vorgangs. governanceTyp = governance|operativ
  (Pflicht). status = offen|entschieden|zurueckgezogen.
- **Bedenken**: gehört zu Vorschlag. Eigenes Datum. Anonym (kein Urheber),
  nur erfasstVon = Protokollführer.
- **Einwand**: gehört zu Vorschlag. schweregrad = leicht|schwerwiegend.
  integration (Pflicht bei schwerwiegend). Eigenes Datum. Anonym.
- **Beschluss**: 0..1 pro Vorschlag. befristung = befristet|unbefristet.
  ueberpruefungsdatum (Pflicht bei befristet). gueltigAb/gueltigBis für den
  Zeitstrahl. gueltigkeitStatus = gueltig|in_ueberpruefung|ersetzt|beendet.
  ersetztBeschluss (Selbstbezug) für Ablösung.
- **Korrekturantrag**: feldweise Änderung an Vorschlag/Bedenken/Einwand/
  Beschluss. Vom Protokollführer beantragt, von einem Admin bestätigt.
- **Benachrichtigung** + **BenachrichtigungEmpfang**: Ereignis plus
  Pro-Person-Lesestatus.

## Sichtbarkeit / Anonymität
- Handlungen (wer hat erfasst) → als Rollen-Label angezeigt
  ("Logbuchführer <Kreis>"), nie als Klarname.
- Bedenken/Einwände → anonym; der Urheber der Sorge wird NICHT gespeichert.
- Namen existieren immer im Hintergrund (Login/Admin/Audit).

## Zeit/Gültigkeit
- gueltigAb = Beschlussdatum. gueltigBis = null, bis ein neuer Beschluss ablöst.
- Ablösung: neuer Beschluss.ersetztBeschlussId = alt; alt.gueltigBis =
  neu.datum; alt.gueltigkeitStatus = ersetzt.
- "Stand zum Stichtag T" = alle Beschlüsse mit gueltigAb ≤ T und
  (gueltigBis = null oder gueltigBis > T).
