import { KontoController } from './konto.controller';

/**
 * Regressionstest: `aenderePasswort` zaehlt
 * `sitzungsGeneration` hoch und entwertet damit auch die Sitzung, aus der
 * heraus gerade gehandelt wird. Ohne ein frisches Cookie landet die Person
 * unmittelbar nach der Erfolgsmeldung auf der Anmeldeseite.
 */
describe('KontoController.aenderePasswort', () => {
  function baue() {
    const konto = { aenderePasswort: jest.fn().mockResolvedValue(undefined) };
    const auth = {
      erstelleSitzungsToken: jest.fn().mockResolvedValue('frisches.jwt'),
    };
    const config = { get: jest.fn(() => '1') };
    const gesetzt: { name?: string; wert?: string; optionen?: unknown } = {};
    const res = {
      cookie: (name: string, wert: string, optionen: unknown) => {
        gesetzt.name = name;
        gesetzt.wert = wert;
        gesetzt.optionen = optionen;
      },
    };
    const controller = new KontoController(
      konto as never,
      auth as never,
      config as never,
    );
    return { controller, konto, auth, res, gesetzt };
  }

  const person = { id: 'p1', istAdmin: false } as never;
  const dto = { altesPasswort: 'alt12345', neuesPasswort: 'neu123456' } as never;

  it('setzt nach dem Wechsel ein frisches Sitzungs-Cookie', async () => {
    const { controller, res, gesetzt } = baue();

    await controller.aenderePasswort(person, dto, res as never);

    expect(gesetzt.name).toBe('sitzung');
    expect(gesetzt.wert).toBe('frisches.jwt');
  });

  it('das Cookie ist httpOnly und auf den ganzen Pfad gesetzt', async () => {
    const { controller, res, gesetzt } = baue();

    await controller.aenderePasswort(person, dto, res as never);

    expect(gesetzt.optionen).toMatchObject({ httpOnly: true, path: '/' });
  });

  it('stellt das Token ERST NACH dem Wechsel aus, sonst traegt es den alten Stand', async () => {
    const { controller, konto, auth, res } = baue();
    const reihenfolge: string[] = [];
    konto.aenderePasswort.mockImplementation(async () => {
      reihenfolge.push('wechsel');
    });
    auth.erstelleSitzungsToken.mockImplementation(async () => {
      reihenfolge.push('token');
      return 'frisches.jwt';
    });

    await controller.aenderePasswort(person, dto, res as never);

    expect(reihenfolge).toEqual(['wechsel', 'token']);
  });

  it('setzt kein Cookie, wenn der Wechsel scheitert', async () => {
    const { controller, konto, res, gesetzt } = baue();
    konto.aenderePasswort.mockRejectedValue(new Error('falsches Passwort'));

    await expect(
      controller.aenderePasswort(person, dto, res as never),
    ).rejects.toThrow();
    expect(gesetzt.name).toBeUndefined();
  });
});
