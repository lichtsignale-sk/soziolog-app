/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // API-Ziel des Dev-Proxys aus VITE_API_TARGET (z. B. aus apps/web/.env.local),
  // Default :3000. Nötig, wenn die API auf einem Ausweich-Port läuft.
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:3000';
  return {
  // Workspace-Pakete aus der TS-Quelle bündeln: Rollup/Vite können so die
  // benannten Exports statisch auflösen (das CommonJS-dist mit __exportStar
  // verbirgt Runtime-Exports vor dem ESM-Bundler). Gilt für Dev, Build und Tests.
  // Array-Form, weil die Reihenfolge zählt: der Unterpfad muss vor dem
  // Paketnamen stehen, sonst greift die kürzere Regel zuerst.
  build: {
    // Vite bettet Assets unter 4 KB als data:-URI ein — darunter
    // eine kleine Schriftdatei. `font-src 'self'` der CSP blockiert data:.
    assetsInlineLimit: 0,
  },
  resolve: {
    alias: [
      {
        // Muss vor der Regel für den Paketnamen stehen: sonst schreibt Vite den
        // @import in index.css auf `src/index.ts/tokens.css` um und der Build bricht.
        find: '@soziolog/ui/tokens.css',
        replacement: fileURLToPath(
          new URL('../../packages/ui/src/tokens.css', import.meta.url),
        ),
      },
      {
        find: '@soziolog/ui/schriften',
        replacement: fileURLToPath(
          new URL('../../packages/ui/src/schriften.ts', import.meta.url),
        ),
      },
      {
        find: '@soziolog/ui',
        replacement: fileURLToPath(
          new URL('../../packages/ui/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@soziolog/shared',
        replacement: fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        // SW im Dev-Modus deaktiviert — verhindert Caching-Konflikte beim Entwickeln
        enabled: false,
      },
      includeAssets: ['favicon.svg'],
      workbox: {
        // Offline-App-Shell: unbekannte Routen fallen auf index.html zurück (SPA).
        navigateFallback: 'index.html',
        // API-Aufrufe NIE cachen – sie brauchen immer frische, autorisierte Daten.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'SozioLog',
        short_name: 'SozioLog',
        description: 'Entscheidungs-Logbuch für soziokratische Gruppen',
        lang: 'de',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      // Hochgeladene Avatare liefert die API unter /uploads aus.
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    // Playwright-E2E-Tests (eigener Runner) nicht von Vitest ausführen lassen.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    },
  };
});
