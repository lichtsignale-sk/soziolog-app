import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/admin.json';

/**
 * Meldet sich EINMAL als Admin an und speichert den Sitzungs-/CSRF-Cookie-Zustand.
 * Alle Tests nutzen diesen Zustand (storageState) – so wird der Login-Throttler
 * (5/min) nicht durch wiederholte Anmeldungen ausgelöst.
 */
/**
 * Zugangsdaten aus `apps/api/prisma/seed.ts`: „Lena Brandt" ist dort die erste
 * Person mit `admin: true`, das Sammel-Passwort aller Seed-Konten ist
 * `demo1234`. Nicht raten — wer den Seed ändert, ändert diese Zeilen mit.
 */
const KENNUNG = 'lena.brandt@solawi-rheintal.de';
const PASSWORT = 'demo1234';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Nutzername oder E-Mail').fill(KENNUNG);
  await page.getByLabel('Passwort').fill(PASSWORT);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Anmelden' }).click(),
  ]);
  await page.waitForURL((url) => url.pathname === '/');
  // Überschrift der Startseite (DomaenenKarte.tsx). Sie belegt, dass die
  // Anmeldung durchgelaufen ist und nicht nur die Route gewechselt hat.
  await expect(page.getByRole('heading', { name: 'Domänen', exact: true })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
