#!/bin/sh
# Wendet ausstehende DB-Migrationen an und startet dann die API.
set -e

echo "[entrypoint] Wende Datenbank-Migrationen an (prisma migrate deploy) ..."
prisma migrate deploy

# Nur Demo-Instanz: bei jedem Start den Demo-Seed einspielen (Reset). Der Seed
# selbst weist einen Lauf ohne DEMO_MODE=1 in Produktion ab; ein Fehler hier darf
# den API-Start NICHT verhindern.
if [ "$DEMO_MODE" = "1" ]; then
  echo "[entrypoint] DEMO_MODE=1 → Demo-Seed einspielen (Reset) ..."
  node dist/prisma/seed.js || echo "[entrypoint] WARNUNG: Demo-Seed fehlgeschlagen – fahre fort."
fi

echo "[entrypoint] Starte API ..."
exec node dist/main
