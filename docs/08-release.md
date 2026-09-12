# Release & Updates

Betriebsmodell: **eine Installation je Organisation** (Single-Tenant-Instanzen).
Ein Update wird gebaut und dann auf jede Instanz ausgerollt.

## Versionierung

- **Semantic Versioning:** MAJOR.MINOR.PATCH.
  - PATCH: Fehlerbehebung, keine neuen Funktionen.
  - MINOR: neue, abwärtskompatible Funktion.
  - MAJOR: inkompatible Änderung (z. B. Datenmodell, das alte Daten anders deutet).
- **Quellen der Versionsnummer (bei jedem Release gemeinsam hochziehen):**
  1. `apps/api/src/version.ts` (`APP_VERSION`) — Laufzeitwert für `/api/version`.
  2. `package.json` in Root, `apps/api`, `apps/web`, `packages/shared`.
  3. Ein neuer datierter Abschnitt in `CHANGELOG.md`.

## Release-Schritte

1. Änderungen auf einem Branch umsetzen, Tests grün:
   `pnpm -r run lint && pnpm -r run test` (+ Integrationstests der API).
2. `CHANGELOG.md`: den Abschnitt `## [Unreleased]` in einen datierten
   `## [X.Y.Z] – JJJJ-MM-TT`-Abschnitt umwandeln, sauber nach Kategorien
   (Hinzugefügt/Geändert/Behoben/Sicherheit/Entfernt).
3. Version an allen drei Stellen (siehe oben) auf `X.Y.Z` setzen.
4. Commit: `Release vX.Y.Z`, dann annotiertes Tag:
   `git tag -a vX.Y.Z -m "vX.Y.Z" && git push --follow-tags`.

## Wie ein Update auf einer Instanz ankommt

Pro Instanz wird das neue Image gebaut und der Stack neu gestartet (von Hand
mit `docker compose … up -d --build` oder z. B. über eine Deployment-Plattform,
ausgelöst durch Git-Push oder Tag):

- **Datenbank:** Der API-Container führt beim Start automatisch
  `prisma migrate deploy` aus (`apps/api/docker-entrypoint.sh`) — neue
  Migrationen wandern ohne manuellen Eingriff in die DB.
- **Backend:** Nach dem Neustart läuft sofort die neue API-Version.
- **Frontend:** Die PWA aktualisiert sich beim nächsten Laden selbst
  (`registerType: 'autoUpdate'`), die Clients ziehen die neue Fassung.
- **Nachvollziehbarkeit:** `GET /api/version` zeigt Version, Commit und
  Build-Zeitpunkt der laufenden Instanz.

Damit `commit`/`gebautAm` gefüllt sind, beim Bauen des API-Images setzen
(z. B. als Build-Arg → Env `APP_GIT_SHA`, `APP_BUILD_TIME`). Fehlen sie, meldet
der Endpunkt `commit: "dev"` / `gebautAm: null` — funktional unkritisch.

## Rollback

- **Code:** vorheriges Tag erneut deployen (`vX.Y.(Z-1)`).
- **Daten:** Prisma-Migrationen sind vorwärtsgerichtet. Eine bereits angewandte,
  Daten verändernde Migration lässt sich nicht einfach zurücknehmen — bei
  riskanten Migrationen vorher das tägliche DB-Backup (`./backups`) sichern und
  im Ernstfall daraus wiederherstellen. Additive Migrationen (neue nullable
  Spalte/Tabelle) sind unkritisch.
- Vor Deploys mit Migrationen: kurz prüfen, ob ein frisches Backup vorliegt.

## Konvention für Commits (empfohlen)

Kurze, deutsche Betreffzeile; für den Changelog leicht zu gruppieren, z. B.
`feat: …`, `fix: …`, `chore: …`. Das Tag markiert den Release-Stand.
