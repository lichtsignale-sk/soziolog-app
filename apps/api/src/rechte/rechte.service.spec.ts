import { RechteService } from './rechte.service';
import { zuDatum, heute } from '@soziolog/shared';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';

function baueService() {
  const prisma = {
    rollenzuweisung: { findFirst: jest.fn() },
    mitgliedschaft: { findFirst: jest.fn() },
  };
  return { service: new RechteService(prisma as never), prisma };
}

const person = (istAdmin: boolean): SitzungsPerson => ({
  id: 'p1',
  organisationId: 'o1',
  name: 'x',
  nutzername: 'x',
  loginEmail: 'x@y.z',
  istAdmin,
  benachrichtigungenAktiv: true,
});

describe('RechteService.istAdmin', () => {
  it('spiegelt person.istAdmin', () => {
    const { service } = baueService();
    expect(service.istAdmin(person(true))).toBe(true);
    expect(service.istAdmin(person(false))).toBe(false);
    expect(service.istAdmin(null)).toBe(false);
  });
});

describe('RechteService.istProtokollfuehrer', () => {
  it('fragt nach gültiger Logbuchführer-Rolle (gueltigBis null oder Zukunft)', async () => {
    const { service, prisma } = baueService();
    prisma.rollenzuweisung.findFirst.mockResolvedValue({ id: 'r1' });

    const ergebnis = await service.istProtokollfuehrer('p1', 'k1');
    expect(ergebnis).toBe(true);

    const where = prisma.rollenzuweisung.findFirst.mock.calls[0][0].where;
    expect(where.rolleTyp).toBe('logbuchfuehrer');
    expect(where.OR).toEqual([
      { gueltigBis: null },
      { gueltigBis: { gt: zuDatum(heute()) } },
    ]);
  });

  it('false, wenn keine gültige Rolle existiert (z. B. beendet)', async () => {
    const { service, prisma } = baueService();
    prisma.rollenzuweisung.findFirst.mockResolvedValue(null);
    expect(await service.istProtokollfuehrer('p1', 'k1')).toBe(false);
  });
});

describe('RechteService.istTeilhabender', () => {
  it('true bei gültiger Mitgliedschaft', async () => {
    const { service, prisma } = baueService();
    prisma.mitgliedschaft.findFirst.mockResolvedValue({ id: 'm1' });
    expect(await service.istTeilhabender('p1', 'k1')).toBe(true);
  });

  it('false ohne Mitgliedschaft', async () => {
    const { service, prisma } = baueService();
    prisma.mitgliedschaft.findFirst.mockResolvedValue(null);
    expect(await service.istTeilhabender('p1', 'k1')).toBe(false);
  });
});

describe('RechteService.hatAndereGueltigeMitgliedschaft', () => {
  it('schließt die angegebene Mitgliedschaft aus', async () => {
    const { service, prisma } = baueService();
    prisma.mitgliedschaft.findFirst.mockResolvedValue(null);
    const ergebnis = await service.hatAndereGueltigeMitgliedschaft('p1', 'm1');
    expect(ergebnis).toBe(false);
    const where = prisma.mitgliedschaft.findFirst.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 'm1' });
  });
});
