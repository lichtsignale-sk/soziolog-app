import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/datenbank';

/**
 * E2E gegen einen EIGENEN Stapel: eigene Wegwerf-Datenbank, eigene Ports,
 * eigene Serverprozesse. Nichts davon berührt die Entwicklungsumgebung.
 *
 * - Datenbank: `E2E_DATABASE_URL` (Vorgabe `soziolog_e2e`), niemals
 *   `DATABASE_URL` — siehe `e2e/datenbank.ts`.
 * - Ports 3100/5273 statt 3000/5173, damit ein laufender Entwicklungsstapel
 *   weder stört noch versehentlich benutzt wird.
 * - `reuseExistingServer: false`: ein fremder Server auf dem Port würde sonst
 *   übernommen — samt seiner Datenbank. Lieber laut scheitern.
 *
 * `globalSetup` setzt den Seed frisch. Schreibende Flows laufen seriell.
 */
const API_PORT = 3100;
const WEB_PORT = 5273;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/admin.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // Voraussetzung: `pnpm --filter @soziolog/api build` wurde ausgeführt.
      command: 'node dist/main',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET: 'e2e-secret',
        CONFIG_KEY: 'e2e-config-key',
        COOKIE_SECURE: '0',
        PORT: String(API_PORT),
        APP_URL: WEB_URL,
        NODE_ENV: 'development',
        // KEIN Postausgang für die E2E-Suite: ohne SMTP_HOST loggt die API die
        // Mails nur. Sonst zieht `ConfigModule` den Wert aus `apps/api/.env`
        // (dort steht Mailpit) — und weil das Anlegen einer Benachrichtigung
        // den Versand ABWARTET, hängt der Korrektur-Flow an der Mailverbindung
        // des Entwicklungsrechners statt an der Anwendung.
        SMTP_HOST: '',
      },
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      cwd: '.',
      url: WEB_URL,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        // vite.config.ts liest das Ziel des /api-Proxys hieraus.
        VITE_API_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
