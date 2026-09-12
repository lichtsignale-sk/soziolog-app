import { test, expect, type Page } from '@playwright/test';

// Alle Tests laufen als angemeldeter Admin (storageState aus auth.setup.ts).
// Schreibende Flows mutieren den Seed -> strikt seriell, Reihenfolge relevant
// (Lesetests vor den Mutationstests).
test.describe.configure({ mode: 'serial' });

/**
 * Nomenklatur: Die Anwendung spricht durchgehend von DOMÄNEN — Route
 * `/domaenen/:id`, Endpunkt `/api/domaenen`, Überschrift „Domänen".
 * „Kreis" steckt nur noch in den Eigennamen der Demo-Daten aus
 * `apps/api/prisma/seed.ts` („Öffentlichkeitskreis"), nicht mehr im Vokabular
 * der Oberfläche. Siehe docs/01-glossar.md.
 */
async function domaeneId(page: Page, name: string): Promise<string> {
  const res = await page.request.get('/api/domaenen');
  const domaenen = (await res.json()) as Array<{ id: string; name: string }>;
  const treffer = domaenen.find((d) => d.name === name);
  if (!treffer) throw new Error(`Domäne „${name}" nicht gefunden`);
  return treffer.id;
}

/** Demo-Domäne mit Bedenken, Einwand und Beschluss am selben Vorschlag. */
const DOMAENE = 'Öffentlichkeitskreis';
const VORSCHLAG = 'Auftritt auf Mastodon aufbauen';

test('1) Angemeldet: Domänen-Übersicht ist sichtbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Domänen', exact: true })).toBeVisible();
});

test('2) Domänen-Log zeigt Vorschlag mit Bedenken/Einwand/Beschluss', async ({ page }) => {
  await page.goto(`/domaenen/${await domaeneId(page, DOMAENE)}`);
  await expect(page.getByRole('heading', { name: DOMAENE })).toBeVisible();

  // Die Karte nennt nur Titel und Zähler; die Label-codierten Abschnitte
  // (Label, nicht nur Farbe) stehen im Detail-Dialog.
  await page.getByRole('button', { name: new RegExp(VORSCHLAG) }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Bedenken', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText('Einwände', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText('Beschluss', { exact: true }).first()).toBeVisible();
});

test('3) Gesamt-Log: Stichtag-Regler und Beschluss-Balken', async ({ page }) => {
  await page.goto('/gesamt-log');
  await expect(page.getByRole('heading', { name: 'Gesamt-Log' })).toBeVisible();
  // Der Stichtag ist heute immer aktiv (grüne Linie im Verlauf), er wird nicht
  // mehr über einen Knopf zugeschaltet.
  await expect(page.getByLabel('Stand zum Stichtag')).toBeVisible();
  // Mindestens ein Beschluss-Balken (der Seed hat gültige Beschlüsse).
  await expect(page.locator('[data-testid^="balken-"]').first()).toBeVisible();
});

test('4) Admin: Archivierung – Vorschau für eine Domäne ohne Mitglieder', async ({ page }) => {
  await page.goto('/admin');
  // „Domänen" ist der erste Reiter der Verwaltung und beim Öffnen aktiv.
  await expect(page.getByRole('tab', { name: 'Domänen' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // „Saatgut-AG" ist im Seed eine Domäne der dritten Ebene ohne
  // Unter-Domänen; alle vier Mitglieder gehören noch weiteren Domänen an
  // -> niemand verwaist. (Die einzige mitgliederlose Domäne des Seeds,
  // „Aktionskreis Hoffest 2025", ist dort bereits archiviert.)
  await page.getByRole('button', { name: 'Saatgut-AG archivieren' }).click();
  await expect(
    page.getByText('Keine Person verwaist durch diese Archivierung.'),
  ).toBeVisible();
  // Nur die Vorschau prüfen – nichts archivieren.
  await page.getByRole('button', { name: 'Abbrechen' }).click();
});

test('5) Korrektur beantragen + bestätigen ändert den Titel; Korrekturen-Log belegt es', async ({
  page,
}) => {
  await page.goto(`/domaenen/${await domaeneId(page, DOMAENE)}`);

  // Detail-Dialog des Vorschlags öffnen und den Titel ändern.
  await page.getByRole('button', { name: new RegExp(VORSCHLAG) }).click();
  await page.getByRole('button', { name: 'Vorschlag bearbeiten' }).click();
  const neuerTitel = 'E2E korrigierter Titel';
  await page.getByLabel('Neuer Titel').fill(neuerTitel);
  // Auf die Antwort warten, nicht nur auf den Klick: ein sofortiges goto()
  // bricht die laufende Anfrage ab, und der Antrag fehlt danach in der Liste.
  const [antwort] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/korrekturen') &&
        r.request().method() === 'POST' &&
        r.ok(),
    ),
    page.getByRole('button', { name: 'Korrekturantrag stellen' }).click(),
  ]);
  const { id: antragId } = (await antwort.json()) as { id: string };

  // Als Admin im Reiter „Korrekturanträge" bestätigen — und zwar GENAU diesen
  // Antrag: der Seed bringt weitere offene Anträge mit, „der erste Bestätigen-
  // Knopf" träfe irgendeinen davon.
  await page.goto('/admin?tab=korrekturen');
  const karte = page.getByTestId(`korrekturantrag-${antragId}`);
  await expect(karte.getByText(neuerTitel)).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith(`/api/korrekturen/${antragId}/bestaetigen`) && r.ok(),
    ),
    karte.getByRole('button', { name: 'Bestätigen' }).click(),
  ]);

  // Der Titel im Logbuch ist jetzt der korrigierte.
  await page.goto(`/domaenen/${await domaeneId(page, DOMAENE)}`);
  await expect(page.getByRole('heading', { name: neuerTitel })).toBeVisible();

  // Korrekturen-Log: neuer Inhalt, Antragstellerin und bestätigende Person.
  await page.goto('/korrekturen-log');
  await expect(page.getByText(neuerTitel).first()).toBeVisible();
  await expect(page.getByText('Antrag von').first()).toBeVisible();
  await expect(page.getByText('Bestätigt von').first()).toBeVisible();
});

test('6) Benachrichtigungszentrum listet die bestätigte Korrektur', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Benachrichtigungen/ }).click();
  await expect(page.getByRole('dialog', { name: 'Benachrichtigungen' })).toBeVisible();
  await expect(page.getByText(/Korrektur/).first()).toBeVisible();
});
