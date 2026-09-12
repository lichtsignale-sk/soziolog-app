import { GoneException, Logger } from '@nestjs/common';
import { AnfrageController } from './anfrage.controller';

/**
 * Die Endpunkte sind stillgelegt — und das MUSS geprüft sein, weil `apps/api`
 * produktiv ist. Zwei Aussagen: es kommt ein 410, und der Inhalt der Anfrage
 * steht vorher im Log. Das Log ist hier die letzte Instanz, die verhindert,
 * dass eine Anfrage verloren geht.
 */
describe('AnfrageController (stillgelegt)', () => {
  let controller: AnfrageController;
  let fehlerLog: jest.SpyInstance;

  beforeEach(() => {
    controller = new AnfrageController();
    fehlerLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    fehlerLog.mockRestore();
  });

  it('antwortet auf eine Demo-Anfrage mit 410', () => {
    expect(() => controller.demo({ email: 'gast@example.org' })).toThrow(
      GoneException,
    );
  });

  it('schreibt KEINE personenbezogenen Daten ins Log ([W10])', () => {
    // Das Log der Kundeninstanzen ist kein Ort für Interessentendaten: keine
    // Auskunft, keine Löschung, kein Aufbewahrungskonzept.
    expect(() =>
      controller.demo({ email: 'gast@example.org', name: 'Gast' }),
    ).toThrow(GoneException);

    const meldung = String(fehlerLog.mock.calls[0][0]);
    expect(meldung).not.toContain('gast@example.org');
    expect(meldung).not.toContain('Gast');
    expect(meldung).toContain('demo');
  });

  it('protokolliert auch bei einer Pilot-Anfrage nur die Art', () => {
    expect(() =>
      controller.pilot({
        organisation: 'Solawi Beispiel',
        name: 'Alex',
        email: 'alex@example.org',
        nachricht: 'Wir hätten Interesse.',
      }),
    ).toThrow(GoneException);

    const meldung = String(fehlerLog.mock.calls[0][0]);
    expect(meldung).not.toContain('Solawi Beispiel');
    expect(meldung).not.toContain('alex@example.org');
    expect(meldung).not.toContain('Wir hätten Interesse.');
    expect(meldung).toContain('pilot');
  });

  it('zählt mit, wie viele noch auf der alten Adresse ankommen', () => {
    // Die Betriebsanzeige für den Umzug: solange der Zähler steigt, zeigt
    // irgendwo noch ein Formular hierher.
    expect(() => controller.demo({ email: 'a@example.org' })).toThrow();
    expect(() => controller.demo({ email: 'b@example.org' })).toThrow();

    expect(String(fehlerLog.mock.calls[0][0])).toContain('die 1.');
    expect(String(fehlerLog.mock.calls[1][0])).toContain('die 2.');
  });

  it('nennt in der Antwort den Weg, der jetzt gilt', () => {
    try {
      controller.demo({ email: 'gast@example.org' });
      fail('Es hätte ein GoneException kommen müssen.');
    } catch (fehler) {
      expect(fehler).toBeInstanceOf(GoneException);
      expect((fehler as GoneException).message).toMatch(/umgezogen/i);
    }
  });
});
