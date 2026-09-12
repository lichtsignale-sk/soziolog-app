# Node 22 (LTS) — Node 20 ist seit dem 30.04.2026 End-of-Life.
# Nur die BAUSTUFE; ausgeliefert wird ein nginx-Image.
FROM node:22-alpine AS build
RUN npm install -g pnpm@11.9.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --prod=false
# shared muss vor web gebaut werden (web bindet @soziolog/shared/dist ein).
RUN pnpm --filter @soziolog/shared build && pnpm --filter @soziolog/web build

# Gepinnt: `nginx:alpine` ist die Mainline und wandert bei jedem
# Rebuild — dasselbe Argument wie beim Lockfile.
FROM nginx:1.28-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# Gemeinsame Sicherheits-Kopfzeilen; die Konfiguration bindet sie ein.
COPY ops/nginx/sicherheitskopfzeilen.conf /etc/nginx/snippets/sicherheit.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
