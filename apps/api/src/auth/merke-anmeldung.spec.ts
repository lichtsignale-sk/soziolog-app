import { AuthService } from './auth.service';
import { heute, zuDatum } from '@soziolog/shared';

/**
 * `merkeAnmeldung` steht zwischen der Ausstellung des Sitzungstokens und
 * dem Setzen des Cookies. Scheitert dieser BETRIEBS-Schreibvorgang, bekäme
 * eine korrekt authentifizierte Person einen 500 und kein Cookie — ausgesperrt,
 * weil eine Kennzahl nicht geschrieben werden konnte.
 */
describe('AuthService.merkeAnmeldung', () => {
  function baue(updateMany: jest.Mock) {
    const prisma = { person: { updateMany } };
    return new AuthService(
      prisma as never,
      {} as never,
      { get: () => undefined } as never,
      {} as never,
    );
  }

  it('hält den Tag der Anmeldung fest', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await baue(updateMany).merkeAnmeldung('p1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { letzteAnmeldungAm: zuDatum(heute()) },
    });
  });

  it('lässt die Anmeldung NICHT scheitern, wenn das Schreiben scheitert', async () => {
    const updateMany = jest.fn().mockRejectedValue(new Error('DB weg'));
    // Ohne das Abfangen flöge hier eine Ausnahme bis in den Controller — und
    // die Person bekäme kein Sitzungs-Cookie.
    await expect(baue(updateMany).merkeAnmeldung('p1')).resolves.toBeUndefined();
  });

  it('läuft auch durch, wenn es die Person gar nicht mehr gibt', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await expect(baue(updateMany).merkeAnmeldung('weg')).resolves.toBeUndefined();
  });
});
