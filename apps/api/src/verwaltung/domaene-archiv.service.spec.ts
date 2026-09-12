import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DomaeneArchivService } from './domaene-archiv.service';
import type { RechteService } from '../rechte/rechte.service';

function baueService() {
  const prisma = {
    domaene: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    vorschlag: { count: jest.fn().mockResolvedValue(0) },
    mitgliedschaft: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    rollenzuweisung: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    person: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  const rechte = { hatMitgliedschaftInAnderemDomaene: jest.fn() };
  const service = new DomaeneArchivService(
    prisma as never,
    rechte as unknown as RechteService,
  );
  return { service, prisma, rechte };
}

const domaeneAktiv = {
  id: 'k1',
  name: 'Bau',
  organisationId: 'org1',
  aktiv: true,
  archiviert: false,
  archiviertAm: null,
  elternDomaeneId: null,
};

describe('DomaeneArchivService.vorschau – Verwaisungserkennung', () => {
  it('listet genau die Person ohne andere gültige Mitgliedschaft', async () => {
    const { service, prisma, rechte } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(domaeneAktiv);
    prisma.domaene.findMany.mockResolvedValue([{ id: 'k2', name: 'Kernkreis' }]);
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      { personId: 'p1', person: { name: 'A' } },
      { personId: 'p2', person: { name: 'B' } },
    ]);
    rechte.hatMitgliedschaftInAnderemDomaene.mockImplementation(
      async (personId: string) => personId === 'p2',
    );
    prisma.rollenzuweisung.findMany.mockResolvedValue([{ rolleTyp: 'moderation' }]);

    const vorschau = await service.vorschau('org1', 'k1');

    expect(vorschau.verwaisende).toEqual([
      { personId: 'p1', name: 'A', rollenImDomaene: ['moderation'] },
    ]);
    expect(vorschau.hatEintraege).toBe(false);
    expect(vorschau.hatAktiveUnterDomaenen).toBe(false);
    expect(vorschau.zielDomaenen).toEqual([{ id: 'k2', name: 'Kernkreis' }]);
  });
});

describe('DomaeneArchivService.archivieren', () => {
  function nurEinVerwaister(
    prisma: ReturnType<typeof baueService>['prisma'],
    rechte: ReturnType<typeof baueService>['rechte'],
  ) {
    prisma.domaene.findFirst.mockResolvedValue(domaeneAktiv);
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      { personId: 'p1', person: { name: 'A' } },
    ]);
    rechte.hatMitgliedschaftInAnderemDomaene.mockResolvedValue(false);
    prisma.rollenzuweisung.findMany.mockResolvedValue([]);
  }

  it('behalten_in_domaene: legt Mitgliedschaft in Ziel-Domäne an und archiviert', async () => {
    const { service, prisma, rechte } = baueService();
    nurEinVerwaister(prisma, rechte);
    prisma.domaene.findMany.mockResolvedValue([{ id: 'k2' }]); // gültige Ziel-Domänen
    prisma.mitgliedschaft.findFirst.mockResolvedValue(null); // noch keine im Ziel

    await service.archivieren('org1', 'k1', {
      entscheidungen: [
        { personId: 'p1', aktion: 'behalten_in_domaene', zielDomaeneId: 'k2' },
      ],
    });

    expect(prisma.mitgliedschaft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ personId: 'p1', domaeneId: 'k2' }),
      }),
    );
    expect(prisma.mitgliedschaft.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ domaeneId: 'k1' }) }),
    );
    expect(prisma.domaene.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'k1' },
        data: expect.objectContaining({ archiviert: true, aktiv: false }),
      }),
    );
  });

  it('loeschen: deaktiviert die Person (aktiv=false), löscht sie NICHT hart', async () => {
    const { service, prisma, rechte } = baueService();
    nurEinVerwaister(prisma, rechte);
    prisma.person.count.mockResolvedValue(2); // genug aktive Admins
    prisma.person.findMany.mockResolvedValue([
      { id: 'p1', istAdmin: false, aktiv: true },
    ]);

    await service.archivieren('org1', 'k1', {
      entscheidungen: [{ personId: 'p1', aktion: 'loeschen' }],
    });

    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { aktiv: false },
    });
    expect(prisma.domaene.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ archiviert: true }),
      }),
    );
  });

  it('Domäne mit aktiven Unter-Domänen -> 422 (Regel A9)', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(domaeneAktiv);
    prisma.domaene.count.mockResolvedValue(1); // eine aktive Unter-Domäne

    await expect(
      service.archivieren('org1', 'k1', { entscheidungen: [] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fehlende Entscheidung für eine verwaisende Person -> 422', async () => {
    const { service, prisma, rechte } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(domaeneAktiv);
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      { personId: 'p1', person: { name: 'A' } },
      { personId: 'p2', person: { name: 'B' } },
    ]);
    rechte.hatMitgliedschaftInAnderemDomaene.mockResolvedValue(false);
    prisma.rollenzuweisung.findMany.mockResolvedValue([]);

    await expect(
      service.archivieren('org1', 'k1', {
        entscheidungen: [{ personId: 'p1', aktion: 'loeschen' }],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bereits archivierte Domäne -> 409', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue({
      ...domaeneAktiv,
      aktiv: false,
      archiviert: true,
      archiviertAm: new Date(),
    });

    await expect(
      service.archivieren('org1', 'k1', { entscheidungen: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DomaeneArchivService.wiederbeleben', () => {
  const archiviert = {
    ...domaeneAktiv,
    aktiv: false,
    archiviert: true,
    archiviertAm: new Date(),
  };

  it('macht die Domäne wieder aktiv und löscht archiviertAm', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(archiviert);

    await service.wiederbeleben('org1', 'k1');

    expect(prisma.domaene.update).toHaveBeenCalledWith({
      where: { id: 'k1' },
      data: { archiviert: false, archiviertAm: null, aktiv: true },
    });
  });

  it('nicht archivierte Domäne -> 409', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(domaeneAktiv);

    await expect(service.wiederbeleben('org1', 'k1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.domaene.update).not.toHaveBeenCalled();
  });

  it('Wiederbeleben unter archiviertem Eltern-Knoten -> 422', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue({
      ...archiviert,
      elternDomaeneId: 'eltern1',
    });
    prisma.domaene.findUnique.mockResolvedValue({ archiviert: true });

    await expect(service.wiederbeleben('org1', 'k1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(prisma.domaene.update).not.toHaveBeenCalled();
  });
});
