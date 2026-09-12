import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    controller = module.get<AppController>(AppController);
  });

  it('health() gibt { status: "ok" } zurück', () => {
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(typeof result.zeitstempel).toBe('number');
  });

  it('version() liefert eine Semver-Version plus commit/gebautAm', () => {
    const result = controller.version();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof result.commit).toBe('string');
    expect(result).toHaveProperty('gebautAm');
  });
});

/**
 * Der Bauzeitpunkt kam im Betrieb nie an: Die Deployment-Plattform lieferte den
 * Commit, aber keinen Bauzeitpunkt, und ein LEER gesetztes APP_BUILD_TIME ist nicht
 * `undefined` — `?? null` liess deshalb den leeren String durch und
 * /api/version zeigte "". Jetzt entscheidet `||`, und das Image bringt einen
 * Rueckfall mit.
 */
describe('AppController.version — Auskunft ueber den laufenden Stand', () => {
  const controller = new AppController();
  const vorher = { ...process.env };
  afterEach(() => {
    process.env = { ...vorher };
  });

  it('nimmt gesetzte Werte aus der Umgebung', () => {
    process.env.APP_GIT_SHA = 'abc123';
    process.env.APP_BUILD_TIME = '2026-09-06T10:00:00Z';
    expect(controller.version()).toMatchObject({
      commit: 'abc123',
      gebautAm: '2026-09-06T10:00:00Z',
    });
  });

  it('behandelt einen LEEREN Wert wie einen fehlenden', () => {
    process.env.APP_GIT_SHA = '';
    expect(controller.version().commit).toBe('dev');
  });

  it('gibt ohne Umgebung und ohne Datei null zurueck', () => {
    delete process.env.APP_BUILD_TIME;
    expect(controller.version().gebautAm).toBeNull();
  });
});
