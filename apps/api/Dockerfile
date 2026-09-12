# Node 22 (LTS). Node 20 ist seit dem 30.04.2026 End-of-Life und bekommt keine
# Sicherheitsupdates mehr; pnpm ab 10 verlangt ohnehin Node >= 22.13.
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.9.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --prod=false
# shared zuerst bauen; dann Prisma-Client generieren (nötig für die TS-Typen im
# nest build), dann die API bauen.
RUN pnpm --filter @soziolog/shared build \
 && pnpm --filter @soziolog/api exec prisma generate \
 && pnpm --filter @soziolog/api build \
 && pnpm --filter @soziolog/api exec tsc -p tsconfig.seed.json

FROM node:22-alpine
# OpenSSL für die Prisma-Engine auf Alpine (sonst libssl-Fehler bei migrate deploy).
RUN apk add --no-cache openssl
RUN npm install -g pnpm@11.9.0
# Prisma-CLL global für `migrate deploy` beim Container-Start (nur @prisma/client
# wäre sonst als Prod-Dependency vorhanden, nicht die CLI).
RUN npm install -g prisma@5.22.0
WORKDIR /app
# DAS LOCKFILE GEHOERT DAZU. Ohne es und ohne --frozen-lockfile loeste
# pnpm die Bereiche aus den package.json frisch auf: Das Laufzeit-Image bekam
# andere Paketstaende als der gepruefte Build, jeder Rebuild konnte still eine
# neue Fassung ziehen, und `pnpm audit` sagte nichts ueber das, was wirklich
# ausgeliefert wird.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --prod --frozen-lockfile --filter @soziolog/api
# Gebautes shared-Paket mitliefern (main = ./dist/index.js).
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
# Prisma-Client für die Runtime generieren (globale CLI-Version = Client-Version).
RUN cd apps/api && prisma generate
# BAUZEITPUNKT INS IMAGE. Viele Deployment-Plattformen liefern den Commit als
# Umgebungsvariable, aber keinen Bauzeitpunkt. Diese Schicht liegt hinter dem COPY
# des gebauten Codes: Sie wird bei jedem echten Bau neu ausgefuehrt und bei
# einem reinen Cache-Treffer uebersprungen — genau das gewuenschte Verhalten.
RUN date -u +%Y-%m-%dT%H:%M:%SZ > ./apps/api/BUILD_TIME

COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

# NICHT ALS ROOT LAUFEN. Das Node-Image bringt den unprivilegierten
# Benutzer `node` bereits mit. Eine Luecke im Anwendungscode bedeutet sonst root
# im Container, samt Schreibrecht auf alles Gemountete.
#
# Das Upload-Verzeichnis wird HIER angelegt und uebereignet: Es ist der einzige
# Pfad, in den die Anwendung zur Laufzeit schreibt. Liegt spaeter ein Volume
# darauf, uebernimmt Docker die Rechte des vorhandenen Verzeichnisses — legte
# man es nicht an, gehoerte der Mountpunkt root und der Upload schluege fehl.
RUN mkdir -p /app/apps/api/uploads/avatare \
 && chown -R node:node /app/apps/api/uploads
USER node

WORKDIR /app/apps/api
EXPOSE 3000
# Healthcheck gegen den vorhandenen Endpunkt GET /api/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
