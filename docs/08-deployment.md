# Deployment & Betrieb

SozioLog besteht aus drei Teilen: **API** (NestJS), **Web** (React-PWA, statisch
via nginx) und **PostgreSQL**. In Produktion terminiert **Caddy** TLS und leitet
`/api/*` an die API, alles andere an die statische Web-App weiter.

## Überblick der Container (`docker-compose.prod.yml`)

| Dienst | Image/Build | Aufgabe |
|---|---|---|
| `db` | postgres:16-alpine | Datenbank, Volume `db-data` |
| `db-backup` | postgres:16-alpine | täglicher `pg_dump` nach `./backups` |
| `api` | `apps/api/Dockerfile` | NestJS; wendet beim Start `prisma migrate deploy` an; Healthcheck `GET /api/health` |
| `web` | `apps/web/Dockerfile` | statische PWA (nginx) |
| `caddy` | caddy:2-alpine | Reverse-Proxy + automatisches TLS (Let's Encrypt) |

---

## 1. Voraussetzungen
- Docker + Docker Compose v2.
- Eine Domäne, die auf den Server zeigt (für automatisches TLS), Ports **80/443**
  offen.

## 2. Konfiguration (`.env`)
`.env` aus der Vorlage erzeugen und Werte setzen (niemals committen — ist
gitignored):

```bash
cp .env.example .env
```

Mindestens ändern (jeweils lange Zufallswerte, z. B. `openssl rand -hex 32`):
- `JWT_SECRET`, `CONFIG_KEY`, `SESSION_SECRET`
- `POSTGRES_PASSWORD`
- `APP_URL` = `https://<deine-domain>`
- `CADDY_DOMAIN` = `<deine-domain>`, `ACME_EMAIL` = deine E-Mail
- `COOKIE_SECURE=1` (Prod erzwingt HTTPS-Cookies)

SMTP kann per Env (`SMTP_*`) gesetzt **oder** später im Setup-Assistenten
hinterlegt werden (dann verschlüsselt in der DB, AES-256-GCM mit `CONFIG_KEY`).

### `KENNZAHLEN_TOKEN` — optional, für zentrale Beobachtung

Nur für Betreiber, die mehrere Instanzen zentral beobachten wollen. Jede
Instanz bekommt dann ein **je Instanz eigen erzeugtes** Geheimnis:

```bash
KENNZAHLEN_TOKEN=$(openssl rand -hex 32)
```

Damit schaltet `GET /api/intern/kennzahlen` frei. Der Endpunkt liefert
**sechs Zählwerte**: aktive Personen, Kreise, Tag des letzten Eintrags, Tag
der letzten Anmeldung, App-Version, Datenbankzustand. **Keine Inhalte** —
keine Namen, keine Vorschläge, keine Beschlüsse.

**Ohne die Variable existiert der Endpunkt nicht (404).** Eine Instanz, die
nie eine Variable bekommt, läuft unverändert weiter und hat auch keinen
zusätzlichen offenen Weg. Der Endpunkt ist ausschliesslich lesend.

Die Erlaubnisliste der Antwortfelder ist in
`apps/api/src/intern/kennzahlen.spec.ts` festgehalten: Der Test lässt kein
siebtes Feld und keinen Wert zu, der kein Zählwert, kein Tagesdatum, keine
Versionsnummer und kein Zustand ist.

### `FEEDBACK_EMPFAENGER` / `FEEDBACK_SCHALTER_URL` — optional, Feedback aus der App

Mit `FEEDBACK_EMPFAENGER=<adresse>` erscheint in der Seitenleiste der Punkt
**„Feedback geben"**. Er öffnet einen Dialog über der aktuellen Seite; das
Absenden schickt eine Mail an diese Adresse (über denselben Postausgang wie
Einladungen). Die Mail enthält:

- den Namen der Organisation — mit `DEMO_MODE=1` stattdessen „Eine Person in
  der Demo",
- die Seite (lesbarer Name und Pfad, ohne Query), Tagesdatum und App-Fassung,
- den Text,
- **nur mit dem Häkchen „Rückfragen erlaubt"** Name und Anmelde-Adresse der
  Person; die Adresse wird dann auch Antwortadresse. In der Demo gibt es das
  Häkchen nicht.

Der Text wird **weder gespeichert noch geloggt**. Pro Adresse gehen höchstens
drei Feedbacks in zehn Minuten, pro Instanz höchstens 30 in der Stunde.

Im Dialog steht „Dein Feedback geht direkt an …". Wer dort genannt wird,
bestimmt `FEEDBACK_EMPFAENGER_NAME` (z. B. `das Team von Beispiel e. V.`);
ohne die Variable heißt es „das Team, das diese Instanz betreut".

**Ohne `FEEDBACK_EMPFAENGER` gibt es den Punkt nicht**, und `POST
/api/feedback` antwortet mit 404.

`FEEDBACK_SCHALTER_URL` ist optional: eine Adresse, die mit
`{ "feedback": true }` oder `{ "feedback": false }` antwortet. Damit lässt sich
das Modul für mehrere Instanzen an einer Stelle abschalten, ohne sie neu
auszurollen. Die Instanz fragt dort höchstens alle fünf Minuten nach und
schickt dabei nichts mit. Ist die Adresse nicht erreichbar, gilt der letzte
bekannte Stand, vor der ersten Antwort „an".

### `SETUP_TOKEN` — schützt das Erst-Setup

```bash
SETUP_TOKEN=$(openssl rand -hex 32)
```

**Warum es das gibt:** `POST /api/setup` ist bis zum Abschluss der Einrichtung
unauthentifiziert — das muss es sein, denn vorher existiert kein Konto. Wer die
frische Subdomain als Erster erreicht, wird damit Admin der Organisation. Und
die Instanz wird im Moment ihrer Erreichbarkeit **öffentlich angekündigt**: Jedes
ausgestellte TLS-Zertifikat steht sekundengenau im
Certificate-Transparency-Log.

Mit gesetztem `SETUP_TOKEN` führt der Weg über den Einladungslink:

```
https://<deine-domain>/api/setup/start?token=<SETUP_TOKEN>
```

`GET /api/setup/start` prüft das Geheimnis zeitkonstant, setzt ein einstündiges
httpOnly-Cookie und leitet auf den Assistenten weiter; `POST /api/setup`
verlangt danach das Cookie. Der Assistent selbst ist unverändert — das
Geheimnis steht nicht in seinem Formular und nicht in seinem Zustand.

**Ohne die Variable verhält sich alles wie bisher.** Eine selbst betriebene
Instanz, bei der niemand ein Geheimnis vergeben kann, lässt sich weiterhin
direkt einrichten; bereits eingerichtete Instanzen sperrt ohnehin der
`SetupGesperrtGuard` (410). Wer Instanzen automatisiert anlegt, sollte die
Variable immer setzen und **keinen** Einladungslink ausgeben, wenn kein
Geheimnis vorliegt — lieber kein Link als einer, der Schutz behauptet, den er
nicht hat.

## 3. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Der `api`-Container führt beim Start automatisch `prisma migrate deploy` aus
(erstellt das Schema in einer frischen DB). Danach ist die App unter
`https://<deine-domain>` erreichbar. Health der API:

```bash
curl -f https://<deine-domain>/api/health   # {"status":"ok",...}
```

---

## 4. Neue Organisation aufsetzen

SozioLog ist pro Instanz **einmandantig** (eine Organisation je Datenbank).

### Eine Instanz
1. Container wie oben starten (leere DB → Migrationen laufen automatisch).
2. `https://<domain>/` öffnen → es erscheint automatisch der **Setup-Assistent**
   (`/setup`), solange noch keine Organisation existiert.
3. Im Assistenten: SMTP-Daten, Organisationsname, Hauptkreis (Name/Ziel/Domäne)
   und die drei Startpersonen (Admin, Moderation, Teilhabende) angeben.
4. Nach Abschluss werden Einladungs-E-Mails versendet; der Setup-Endpunkt ist
   danach dauerhaft gesperrt (`410 Gone`).

### Mehrere Organisationen betreiben
Pro Organisation eine **eigene Instanz** (eigene DB + eigener Stack, z. B. je
Organisation ein Compose-Projekt mit eigener `.env`/Domäne). So bleiben Daten
und Setup-Assistent strikt getrennt. Danach identisch zum Ablauf für eine
Instanz (Schritte 2–4).

> Hinweis: Setup + Einladungseinlösung sind durch API-Integrations-/Unit-Tests
> abgedeckt (org-frische DB); die E2E-Suite (Playwright) prüft die
> authentifizierten Hauptpfade gegen die Demo-Daten.

---

## 5. Datenbank-Migrationen
- **Automatisch** beim `api`-Start (`prisma migrate deploy`, im Entrypoint).
- Manuell (z. B. nach Update ohne Neustart):
  ```bash
  docker compose -f docker-compose.prod.yml exec api prisma migrate deploy
  ```

## 6. Backup & Restore

### Automatisches Backup
Der Dienst `db-backup` schreibt täglich `./backups/soziolog-<zeit>.sql.gz` und
löscht Dumps älter als `BACKUP_RETENTION_DAYS` (Standard 14). Die `./backups`
zusätzlich extern sichern (z. B. Objektspeicher, verschlüsselt).

### Manuelles Backup
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump --clean --if-exists -U soziolog soziolog | gzip > backups/manuell-$(date +%F).sql.gz
```
`--clean --if-exists` fügt DROP-Anweisungen ein, sodass ein Restore idempotent in
eine bestehende Datenbank zurückspielt (keine „bereits vorhanden"-Fehler).

### Restore (WICHTIG: einmal echt durchspielen!)
```bash
# 1. API stoppen, damit keine Schreibzugriffe laufen
docker compose -f docker-compose.prod.yml stop api

# 2. Datenbank leeren und aus dem Dump wiederherstellen
gunzip -c backups/soziolog-<zeit>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U soziolog -d soziolog

# 3. API wieder starten
docker compose -f docker-compose.prod.yml start api
```
Anschließend Login prüfen. Restores nicht nur konfigurieren, sondern regelmäßig
**testen**.

### Ruheverschlüsselung
Das DB-Volume (`db-data`) und die Backups auf einem verschlüsselten Dateisystem/
Volume ablegen (z. B. LUKS, Cloud-Volume-Encryption). SMTP-Zugangsdaten werden in
der DB bereits mit AES-256-GCM verschlüsselt (`CONFIG_KEY`).

---

## 7. Reset / Demo-Daten (nur Test/Staging)
Setzt die DB komplett zurück und lädt die Demo-Gemeinschaft
(`admin@demo.test` / `demo1234`):
```bash
docker compose -f docker-compose.prod.yml exec api \
  sh -c "prisma migrate reset --force"
```
**Niemals in Produktion** ausführen — löscht alle Daten.

---

## 8. Lokale Entwicklung
Siehe `README.md`. Kurz: DB via `docker compose up db mailpit`, dann
`pnpm --filter api dev` und `pnpm --filter web dev`. Für Cookies lokal
`COOKIE_SECURE=0`.
