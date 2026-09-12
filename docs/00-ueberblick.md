# Überblick

SozioLog dokumentiert Entscheidungen soziokratischer Kreise zeitgenau und
transparent. Kernidee: der aktuelle "Stand" einer Domäne ist die Summe aller
noch gültigen Beschlüsse; jeder frühere Stand ist über die Gültigkeitsspannen
rekonstruierbar ("Rückspulen").

## Architektur (API-first)
Web-App (responsiv, PWA) und optionale spätere native Apps sprechen mit einer
NestJS-JSON-API. Die API spricht mit PostgreSQL und einem SMTP-Dienst.
Backend + DB laufen als EINE Docker-Instanz pro Organisation.

## Ordnerstruktur
- apps/api        NestJS-Backend
- apps/web        React+Vite-Frontend (PWA)
- packages/shared Gemeinsame TypeScript-Typen und Datums-Helfer
- docs/           Spezifikation (diese Dateien)

## Deployment
Eine Instanz pro Organisation. SaaS = du hostest N Instanzen. On-Premise =
Kunde startet eine Instanz. Duplizierung über Docker Compose.
