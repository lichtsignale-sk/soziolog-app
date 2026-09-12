# Fehlerbehandlung, Logging, Debugging

## Einheitliches API-Fehlerformat
Jede Fehlerantwort: { "fehler": { "code": string, "nachricht": string,
"detail"?: unknown } }. HTTP-Status passend (400/401/403/404/409/422/500).

## Backend
- pino-Logger mit Request-ID pro Anfrage.
- Globaler Exception-Filter (NestJS) fängt alles ab, loggt Stacktrace, gibt das
  einheitliche Fehlerformat zurück.
- Validierung mit zod/class-validator an der API-Grenze; 422 bei Verstoß.

## Frontend
- React ErrorBoundary; im Dev-Modus sichtbares Fehler-Overlay auf dem Screen.
- Zentraler API-Client (fetch/axios) mit Interceptor: API-Fehler werden als
  sichtbarer Hinweis (Toast) UND in der Konsole ausgegeben.
- Dev-Flag VITE_DEBUG=1 macht ausführliche Debug-Infos sichtbar.

## Fehler-Tracking (empfohlen)
Sentry (kostenlose Stufe) in api und web einbinden, aktiv nur wenn SENTRY_DSN
gesetzt ist. Liefert bei jedem Fehler eine Meldung mit Stacktrace (Dev + Prod).

## Bekannte Risikostellen (mit Tests absichern)
- Datums-Handling (Zeitzonen-Verschiebung um 1 Tag) → Nur-Datum + shared-Helfer.
- Zeit-/Gültigkeits-Engine (Ablösung, "Stand zum Stichtag").
- Kreis-Löschung mit verwaisten Personen (Regel b).
- Korrektur-Bestätigung durch mehrere Admins gleichzeitig (Nebenläufigkeit).
- Serverseitige Pflicht-Integration bei schwerwiegendem Einwand.
- Idempotenz des Setup-Assistenten.
