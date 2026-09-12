import { execSync } from 'node:child_process';
import { E2E_DATABASE_URL, pruefeZieldatenbank } from './datenbank';

/**
 * Setzt vor der E2E-Suite die WEGWERF-Datenbank auf den frischen Seed zurück,
 * damit die Tests deterministisch gegen die Demo-Daten laufen.
 *
 * Die Entwicklungsdatenbank wird dabei nicht angefasst: Ziel ist ausschließlich
 * `E2E_DATABASE_URL`, und `pruefeZieldatenbank` bricht vorher ab, wenn die
 * Verbindung nicht erkennbar auf eine Testdatenbank zeigt.
 */
export default function globalSetup(): void {
  const name = pruefeZieldatenbank(E2E_DATABASE_URL);
  process.stdout.write(`\nE2E-Datenbank wird zurückgesetzt: ${name}\n\n`);

  execSync('pnpm exec prisma migrate reset --force', {
    cwd: new URL('../../api', import.meta.url).pathname,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
}
