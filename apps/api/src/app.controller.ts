import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from './version';

/**
 * Bauzeitpunkt aus der Datei, die das Image mitbringt.
 *
 * Viele Deployment-Plattformen setzen den Commit, aber keinen Bauzeitpunkt — ohne
 * diesen Rueckfall bliebe `gebautAm` in jedem Deployment leer, und im
 * Stoerungsfall fehlte die Auskunft, welcher Stand laeuft. Die Datei entsteht
 * im Dockerfile hinter dem COPY des gebauten Codes.
 *
 * EINMAL beim Start gelesen: Der Wert aendert sich zur Laufzeit nie, und ein
 * Dateizugriff je Anfrage waere Verschwendung. Fehlt die Datei (Entwicklung,
 * `pnpm dev`), bleibt es bei `null`.
 */
function bauzeitpunktAusDatei(): string | null {
  try {
    return readFileSync(join(__dirname, '..', 'BUILD_TIME'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

const BAUZEITPUNKT = bauzeitpunktAusDatei();

@Controller()
export class AppController {
  @Get('health')
  health(): { status: string; zeitstempel: number } {
    return { status: 'ok', zeitstempel: Date.now() };
  }

  /**
   * Laufende Version für Betrieb/Support: App-Version (aus version.ts) plus
   * Commit-SHA und Build-Zeitpunkt, die beim Bauen als Env gesetzt werden
   * (APP_GIT_SHA / APP_BUILD_TIME). So ist im Betrieb eindeutig erkennbar,
   * welcher Stand auf einer Instanz läuft.
   */
  @Get('version')
  version(): { version: string; commit: string; gebautAm: string | null } {
    return {
      version: APP_VERSION,
      commit: process.env.APP_GIT_SHA || 'dev',
      gebautAm: process.env.APP_BUILD_TIME || BAUZEITPUNKT,
    };
  }
}
