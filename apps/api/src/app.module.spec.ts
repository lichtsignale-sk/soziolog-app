import { Test } from '@nestjs/testing';

/**
 * DIE UNTERGRENZE, HIER EBENSO ([K6]).
 *
 * In der Verwaltung ging Etappe 3 mit 564 grünen Tests aus der Hand — und die
 * Anwendung startete nicht, weil kein Test das `AppModule` compilierte. Die
 * Lehre gilt nicht nur dort: Diese Etappe hat auch in `apps/api` an der
 * Verdrahtung gearbeitet (`InternModule`, `SetupTokenGuard`, `ConfigService`
 * im `SetupController`). Ein Verdrahtungsfehler zeigt sich erst beim
 * Hochfahren, und Unit-Tests, die ihre Dienste mit `new` bauen, sehen ihn nie.
 *
 * Der Test stellt keine Datenbankverbindung her: `compile()` ruft keine
 * Lebenszyklus-Haken.
 */

const PFLICHTUMGEBUNG: Record<string, string> = {
  DATABASE_URL: 'postgresql://niemand:niemand@localhost:1/niemand?schema=public',
  JWT_SECRET: 'test-jwt-geheimnis',
  CONFIG_KEY: 'test-schluessel-mindestens-32-zeichen-lang-x',
  SESSION_SECRET: 'test-sitzungsgeheimnis',
  APP_URL: 'http://localhost:5173',
  NODE_ENV: 'test',
};

describe('AppModule lässt sich zusammensetzen', () => {
  const vorher = { ...process.env };

  beforeAll(() => {
    for (const [name, wert] of Object.entries(PFLICHTUMGEBUNG)) {
      process.env[name] = wert;
    }
  });

  afterAll(() => {
    process.env = vorher;
  });

  it('löst jede Abhängigkeit jedes Providers auf', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('./app.module') as { AppModule: unknown };

    const modul = await Test.createTestingModule({
      imports: [AppModule as never],
    }).compile();

    expect(modul).toBeDefined();
    await modul.close();
  });

  it('kennt den internen Kennzahlen-Zugang und den Setup-Schutz', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppModule } = require('./app.module') as { AppModule: unknown };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { KennzahlenService } = require('./intern/kennzahlen.service') as never;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SetupTokenGuard } = require('./setup/setup-token.guard') as never;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SetupController } = require('./setup/setup.controller') as never;

    const modul = await Test.createTestingModule({
      imports: [AppModule as never],
    }).compile();

    expect(modul.get(KennzahlenService)).toBeDefined();
    expect(modul.get(SetupTokenGuard)).toBeDefined();
    // Der Controller bekam in dieser Etappe eine zweite Abhängigkeit
    // (ConfigService) — genau die Art Änderung, die beim Hochfahren scheitert.
    expect(modul.get(SetupController)).toBeDefined();
    await modul.close();
  });
});
