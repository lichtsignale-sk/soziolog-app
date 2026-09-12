# SozioLog

Zeitbewusstes Entscheidungs-Logbuch für soziokratisch organisierte Gruppen.

SozioLog ist freie Software unter der **GNU Affero General Public License,
Version 3** (siehe [LICENSE](LICENSE) und [NOTICE](NOTICE)). Dieses Repository
enthält die vollständige Anwendung (API und Web-Oberfläche) zum Selbstbetrieb.
Wer SozioLog selbst betreibt, darf das ohne Gegenleistung tun; wir empfehlen
einen einmaligen Beitrag von 250 € pro Instanz, frei wählbar.

Gehosteter Betrieb und Kontakt: [soziolog.com](https://soziolog.com) ·
hallo@soziolog.com

## Voraussetzungen

- Node.js ≥ 22.13
- pnpm (die Version aus `packageManager` in `package.json`, z. B. über
  `corepack enable`)
- Docker + Docker Compose

## Lokale Entwicklung (Host)

```bash
# 1. Abhängigkeiten installieren und Prisma-Client erzeugen
pnpm install
pnpm --filter @soziolog/api exec prisma generate

# 2. Umgebungsvariablen anlegen
cp .env.example .env
# .env anpassen (mind. DATABASE_URL, SESSION_SECRET)

# 3. Datenbank starten (Docker) und Schema anlegen
docker compose up db -d
pnpm --filter @soziolog/api exec prisma migrate deploy

# 4. API + Web starten
pnpm dev
```

API läuft auf http://localhost:3000, Web auf http://localhost:5173.

## Vollständig per Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- Mailpit (abgefangene Mails): http://localhost:8025

## Produktion / Selbstbetrieb

Der Produktions-Stack (PostgreSQL mit täglichem Backup, API mit automatischer
Migration, statische PWA, Caddy als TLS-Reverse-Proxy) liegt in
[`docker-compose.prod.yml`](docker-compose.prod.yml):

```bash
cp .env.example .env   # Secrets, APP_URL, CADDY_DOMAIN, COOKIE_SECURE=1 setzen
docker compose -f docker-compose.prod.yml up -d --build
```

Vollständige Anleitung (neue Organisation aufsetzen, Backup/Restore, Reset):
**[docs/08-deployment.md](docs/08-deployment.md)**.

## End-to-End-Tests

Playwright deckt die authentifizierten Hauptpfade ab (Login, Kern-Flow,
Gesamt-Log/Stichtag, Korrektur+Bestätigung, Kreis-Auflösung, Benachrichtigung).
Setzt eine laufende Docker-DB voraus:

```bash
docker compose up db -d
pnpm --filter api build
pnpm --filter web exec playwright install chromium   # einmalig
pnpm e2e
```

## Skripte

| Befehl | Beschreibung |
|---|---|
| `pnpm dev` | API + Web im Watch-Modus starten |
| `pnpm build` | Alle Pakete bauen |
| `pnpm test` | Alle Unit-Tests ausführen |
| `pnpm --filter @soziolog/api test:integration` | Integrationstests der API (Docker-DB nötig) |
| `pnpm lint` | TypeScript-Typen prüfen |
| `pnpm e2e` | Playwright-E2E-Tests (Docker-DB nötig) |

## Umgebungsvariablen

Siehe [.env.example](.env.example) für alle verfügbaren Variablen.

## Architektur

- **apps/api** — NestJS-Backend (REST-API, Port 3000)
- **apps/web** — React + Vite Frontend (PWA, Port 5173)
- **packages/shared** — Gemeinsame TypeScript-Typen und Datums-Helfer
- **packages/ui** — Design-System (Komponenten, Tokens, Schriften)
- **docs/** — Fachspezifikation

## Lizenz

Copyright (C) 2026 Lichtsignale GmbH & Co KG

Dieses Programm ist freie Software: Sie können es unter den Bedingungen der
GNU Affero General Public License, Version 3, weitergeben und/oder verändern.
Wer eine veränderte Fassung als Netzwerkdienst für andere betreibt, muss den
Nutzerinnen und Nutzern den Quelltext dieser Fassung zugänglich machen
(§ 13 AGPL).
