import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { PersonVerwaltungService } from './person-verwaltung.service';
import type { EinladungService } from './einladung.service';

function baueService() {
  const prisma = {
    person: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    vorschlag: { count: jest.fn().mockResolvedValue(0) },
    bedenken: { count: jest.fn().mockResolvedValue(0) },
    einwand: { count: jest.fn().mockResolvedValue(0) },
    beschluss: { count: jest.fn().mockResolvedValue(0) },
    korrekturantrag: { count: jest.fn().mockResolvedValue(0) },
    einladung: { deleteMany: jest.fn() },
    passwortReset: { deleteMany: jest.fn() },
    benachrichtigungEmpfang: { deleteMany: jest.fn() },
    rollenzuweisung: { deleteMany: jest.fn() },
    mitgliedschaft: { deleteMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const einladung = { neuAusstellen: jest.fn().mockResolvedValue('token') };
  const service = new PersonVerwaltungService(
    prisma as never,
    einladung as unknown as EinladungService,
  );
  return { service, prisma, einladung };
}

describe('PersonVerwaltungService.aktualisieren – Letzter-Admin-Schutz', () => {
  it('422 beim Degradieren des letzten aktiven Admins', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p1', istAdmin: true });
    prisma.person.count.mockResolvedValue(0); // keine anderen aktiven Admins

    await expect(
      service.aktualisieren('p1', { istAdmin: false }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('erlaubt Degradieren, wenn ein weiterer aktiver Admin existiert', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p1', istAdmin: true });
    prisma.person.count.mockResolvedValue(1);
    prisma.person.update.mockResolvedValue({
      id: 'p1',
      organisationId: 'o1',
      name: 'x',
      nutzername: 'x',
      loginEmail: 'x@y.z',
      istAdmin: false,
      aktiv: true,
      benachrichtigungenAktiv: true,
    });

    const person = await service.aktualisieren('p1', { istAdmin: false });
    expect(person.istAdmin).toBe(false);
  });
});

describe('PersonVerwaltungService.loeschen', () => {
  it('409, wenn die Person unveränderliche Log-Einträge hat', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p1', istAdmin: false });
    prisma.vorschlag.count.mockResolvedValue(2); // hat Vorschläge erfasst

    await expect(service.loeschen('p1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('löscht abhängige Zeilen transaktional, wenn keine Log-Einträge existieren', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p1', istAdmin: false });

    await service.loeschen('p1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.mitgliedschaft.deleteMany).toHaveBeenCalledWith({
      where: { personId: 'p1' },
    });
  });
});

describe('PersonVerwaltungService.alle – Admin-Personenliste', () => {
  it('ordnet jeder Person genau ihre eigenen gültigen Domaenen/Rollen zu', async () => {
    const { service, prisma } = baueService();
    prisma.person.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Alice',
        nutzername: 'alice',
        loginEmail: 'a@x',
        istAdmin: true,
        aktiv: true,
        benachrichtigungenAktiv: true,
        angelegtAm: new Date('2026-07-01T00:00:00.000Z'),
        mitgliedschaften: [
          { domaene: { id: 'k1', name: 'Kernkreis' } },
        ],
        rollen: [{ domaeneId: 'k1', rolleTyp: 'logbuchfuehrer' }],
      },
      {
        id: 'p2',
        name: 'Bob',
        nutzername: 'bob',
        loginEmail: 'b@x',
        istAdmin: false,
        aktiv: true,
        benachrichtigungenAktiv: true,
        angelegtAm: new Date('2026-07-02T00:00:00.000Z'),
        mitgliedschaften: [{ domaene: { id: 'k2', name: 'Bau' } }],
        rollen: [], // keine Rollen in k2, nur Teilhabender
      },
    ]);

    const ergebnis = await service.alle('org1');

    expect(ergebnis).toHaveLength(2);
    expect(ergebnis[0].domaenen).toEqual([
      { domaeneId: 'k1', name: 'Kernkreis', rollen: ['logbuchfuehrer'] },
    ]);
    // Rollen von p1 dürfen nicht bei p2 auftauchen (kein Vermischen zwischen Personen).
    expect(ergebnis[1].domaenen).toEqual([
      { domaeneId: 'k2', name: 'Bau', rollen: [] },
    ]);
  });
});

describe('PersonVerwaltungService.hole', () => {
  it('gibt die öffentlichen Felder zurück', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      organisationId: 'org1',
      name: 'Alice',
      nutzername: 'alice',
      loginEmail: 'a@x',
      istAdmin: false,
      aktiv: true,
      benachrichtigungenAktiv: true,
      passwortHash: 'geheim',
    });

    const person = await service.hole('p1');

    expect(person).toEqual({
      id: 'p1',
      organisationId: 'org1',
      name: 'Alice',
      nutzername: 'alice',
      loginEmail: 'a@x',
      istAdmin: false,
      aktiv: true,
      benachrichtigungenAktiv: true,
    });
  });
});
