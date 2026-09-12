import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Zieldatenbank der E2E-Suite — bewusst eine EIGENE, jederzeit wegwerfbare
 * Datenbank.
 *
 * Hintergrund: `global-setup.ts` fährt `prisma migrate reset --force`. Zeigte
 * die Verbindung auf die Entwicklungsdatenbank, wäre die Arbeit des Nutzers
 * weg. Deshalb gilt hier:
 *
 * 1. Die Suite liest **nicht** die Umgebungsvariable `DATABASE_URL` — genau
 *    die steht in Entwicklungs-Shells üblicherweise auf der
 *    Entwicklungsdatenbank.
 * 2. Ohne eigene Vorgabe leitet sie sich aus `apps/api/.env` ab und hängt an
 *    den Datenbanknamen `_e2e` an. Sie folgt damit automatisch dem Host und
 *    Port der Entwicklungsumgebung (lokal etwa Port 5433 statt 5432), kann
 *    aber durch das angehängte Suffix nie auf der Entwicklungsdatenbank
 *    selbst landen. Die Datenbank legt `prisma migrate reset` bei Bedarf an.
 * 3. `pruefeZieldatenbank` bricht ab, wenn der Name trotzdem nicht erkennbar
 *    zu einer Testdatenbank gehört. Ein `reset --force` kann so nicht mehr aus
 *    Versehen die falsche Datenbank treffen.
 */

/** Datenbanken, die unter keinen Umständen zurückgesetzt werden dürfen. */
const VERBOTEN = ['soziolog', 'soziolog_control', 'postgres'];

/** Letzter Rückfall, falls es keine apps/api/.env gibt. */
const RUECKFALL =
  'postgresql://soziolog:soziolog@localhost:5433/soziolog_e2e?schema=public';

/** Hängt `_e2e` an den Datenbanknamen einer Verbindungszeichenfolge an. */
function mitTestdatenbank(url: string): string | null {
  try {
    const ziel = new URL(url);
    const name = decodeURIComponent(ziel.pathname).replace(/^\//, '');
    if (!name) return null;
    ziel.pathname = `/${name}_e2e`;
    return ziel.toString();
  } catch {
    return null;
  }
}

/** Liest DATABASE_URL aus apps/api/.env — nicht aus der Umgebung. */
function ausApiUmgebungsdatei(): string | null {
  try {
    const pfad = fileURLToPath(new URL('../../api/.env', import.meta.url));
    for (const zeile of readFileSync(pfad, 'utf8').split('\n')) {
      const treffer = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/.exec(zeile);
      if (treffer) return treffer[1].replace(/^["']|["']$/g, '');
    }
  } catch {
    // Keine .env — dann greift der Rückfall.
  }
  return null;
}

function ermittleUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const ausDatei = ausApiUmgebungsdatei();
  return (ausDatei && mitTestdatenbank(ausDatei)) ?? RUECKFALL;
}

export const E2E_DATABASE_URL = ermittleUrl();

/**
 * Prüft, ob die Verbindung auf eine Wegwerf-Datenbank zeigt, und gibt deren
 * Namen zurück. Wirft mit einer Meldung, die sagt, was zu tun ist.
 */
export function pruefeZieldatenbank(url: string): string {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname).replace(/^\//, '');
  } catch {
    throw new Error(
      `E2E_DATABASE_URL ist keine gültige Verbindungszeichenfolge: "${url}"`,
    );
  }

  if (!name) {
    throw new Error(
      `E2E_DATABASE_URL nennt keine Datenbank: "${url}"\n` +
        'Erwartet wird etwas wie …:5433/soziolog_e2e?schema=public',
    );
  }

  if (VERBOTEN.includes(name) || !/e2e/i.test(name)) {
    throw new Error(
      [
        '',
        'ABBRUCH: Die E2E-Suite setzt ihre Zieldatenbank mit',
        '`prisma migrate reset --force` vollständig zurück.',
        '',
        `Angegeben ist aber die Datenbank "${name}".`,
        'Zurückgesetzt wird nur, was erkennbar eine Testdatenbank ist —',
        'der Name muss "e2e" enthalten und darf keine der produktiv',
        `genutzten sein (${VERBOTEN.join(', ')}).`,
        '',
        'Ohne eigene Vorgabe leitet sich das Ziel aus apps/api/.env ab',
        '(Datenbankname plus „_e2e"). Eigenes Ziel setzen:',
        '  E2E_DATABASE_URL=postgresql://…/meine_e2e?schema=public pnpm e2e',
        '',
      ].join('\n'),
    );
  }

  return name;
}
