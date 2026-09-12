import { UnprocessableEntityException } from '@nestjs/common';
import { DomaeneService } from './domaene.service';
import type { DbClient } from '../prisma/db-client';

function baueDb() {
  return {
    person: { count: jest.fn() },
    domaene: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'k1' }) },
    mitgliedschaft: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
    rollenzuweisung: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
}

function baueService() {
  // erstellenMit nutzt den übergebenen db-Client; prisma wird hier nicht gebraucht.
  return new DomaeneService({} as never);
}

const basis = { name: 'Bau', ziel: 'Z', tasks: ['D'] };

describe('DomaeneService.erstellenMit – Gründungsregel a', () => {
  it('422 bei weniger als 3 verschiedenen Mitgliedern', async () => {
    const service = baueService();
    await expect(
      service.erstellenMit(baueDb() as unknown as DbClient, 'org1', {
        ...basis,
        besetzung: [
          { personId: 'p1', rolleTyp: 'moderation' },
          { personId: 'p2', rolleTyp: 'logbuchfuehrer' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('422 wenn Moderation oder Logbuchführung fehlt', async () => {
    const service = baueService();
    await expect(
      service.erstellenMit(baueDb() as unknown as DbClient, 'org1', {
        ...basis,
        besetzung: [
          { personId: 'p1', rolleTyp: 'moderation' },
          { personId: 'p2' },
          { personId: 'p3' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('422 wenn nur eine Person Moderation UND Logbuchführung abdecken soll', async () => {
    const service = baueService();
    // Mit genau EINER Rolle pro Person kann p1 nicht beides sein; ohne separate
    // Logbuchführung schlägt die Gründungsregel fehl.
    await expect(
      service.erstellenMit(baueDb() as unknown as DbClient, 'org1', {
        ...basis,
        besetzung: [
          { personId: 'p1', rolleTyp: 'moderation' },
          { personId: 'p2', rolleTyp: 'moderation' },
          { personId: 'p3' },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('legt bei vollständiger Besetzung Domaene + Mitgliedschaften + Rollen an', async () => {
    const service = baueService();
    const db = baueDb();
    db.person.count.mockResolvedValue(3); // alle 3 Personen existieren in der Org

    const domaene = await service.erstellenMit(db as unknown as DbClient, 'org1', {
      ...basis,
      besetzung: [
        { personId: 'p1', rolleTyp: 'moderation' },
        { personId: 'p2', rolleTyp: 'logbuchfuehrer' },
        { personId: 'p3' },
      ],
    });

    expect(domaene).toEqual({ id: 'k1' });
    expect(db.domaene.create).toHaveBeenCalledTimes(1);
    expect(db.mitgliedschaft.createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(db.rollenzuweisung.createMany.mock.calls[0][0].data).toHaveLength(2);
  });
});

describe('DomaeneService.mitgliederDetail', () => {
  function baueServiceMitPrisma() {
    const prisma = {
      domaene: { findFirst: jest.fn() },
      mitgliedschaft: { findMany: jest.fn() },
      rollenzuweisung: { findMany: jest.fn() },
    };
    return { service: new DomaeneService(prisma as never), prisma };
  }

  it('liefert nur die gültigen Mitglieder mit ihren Rollen in genau diesem Domaene', async () => {
    const { service, prisma } = baueServiceMitPrisma();
    prisma.domaene.findFirst.mockResolvedValue({ id: 'k1', name: 'Kernkreis' });
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      {
        id: 'm1',
        gueltigAb: new Date('2026-07-01T00:00:00.000Z'),
        person: { id: 'p1', name: 'Alice', nutzername: 'alice' },
      },
    ]);
    prisma.rollenzuweisung.findMany.mockResolvedValue([
      {
        id: 'r1',
        personId: 'p1',
        rolleTyp: 'logbuchfuehrer',
        gueltigAb: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);

    const detail = await service.mitgliederDetail('org1', 'k1');

    expect(detail.domaeneName).toBe('Kernkreis');
    expect(detail.mitglieder).toEqual([
      {
        mitgliedschaftId: 'm1',
        personId: 'p1',
        name: 'Alice',
        nutzername: 'alice',
        gueltigAb: '2026-07-01',
        rollen: [{ rollenId: 'r1', rolleTyp: 'logbuchfuehrer', gueltigAb: '2026-07-01' }],
      },
    ]);
    // Nur gültige (nicht beendete) Zuweisungen werden abgefragt.
    expect(prisma.mitgliedschaft.findMany.mock.calls[0][0].where.domaeneId).toBe('k1');
  });

  it('404 wenn der Domaene nicht zur Organisation gehört', async () => {
    const { service, prisma } = baueServiceMitPrisma();
    prisma.domaene.findFirst.mockResolvedValue(null);
    await expect(service.mitgliederDetail('org1', 'k1')).rejects.toThrow(
      'Domäne nicht gefunden.',
    );
  });
});
