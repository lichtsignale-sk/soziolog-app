import { UnprocessableEntityException } from '@nestjs/common';
import { RollenService } from './rollen.service';
import type { RechteService } from '../rechte/rechte.service';

function baueService() {
  const prisma = {
    rollenzuweisung: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'neu' }),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  const rechte = { istTeilhabender: jest.fn().mockResolvedValue(true) };
  const service = new RollenService(
    prisma as never,
    rechte as unknown as RechteService,
  );
  return { service, prisma, rechte };
}

describe('RollenService.setzen – genau eine Rolle pro (Person, Domäne)', () => {
  it('422, wenn die Person kein Mitglied der Domäne ist', async () => {
    const { service, rechte } = baueService();
    rechte.istTeilhabender.mockResolvedValue(false);

    await expect(service.setzen('k1', 'p1', 'moderation')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('beendet vorhandene andere Rollen und legt die neue Rolle an', async () => {
    const { service, prisma } = baueService();
    prisma.rollenzuweisung.findFirst.mockResolvedValue(null); // hat die neue Rolle noch nicht
    prisma.rollenzuweisung.findMany.mockResolvedValue([{ id: 'alt' }]); // eine andere Rolle aktiv

    await service.setzen('k1', 'p1', 'logbuchfuehrer');

    // Andere aktive Rollen werden beendet …
    expect(prisma.rollenzuweisung.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          personId: 'p1',
          domaeneId: 'k1',
          rolleTyp: { not: 'logbuchfuehrer' },
        }),
        data: expect.objectContaining({ gueltigBis: expect.anything() }),
      }),
    );
    // … und die neue Rolle angelegt.
    expect(prisma.rollenzuweisung.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domaeneId: 'k1',
          personId: 'p1',
          rolleTyp: 'logbuchfuehrer',
        }),
      }),
    );
  });

  it('ist idempotent, wenn die Person schon genau diese Rolle hat', async () => {
    const { service, prisma } = baueService();
    prisma.rollenzuweisung.findFirst.mockResolvedValue({ id: 'gleich' }); // hat die Rolle schon
    prisma.rollenzuweisung.findMany.mockResolvedValue([]); // keine anderen Rollen

    const ergebnis = await service.setzen('k1', 'p1', 'moderation');

    expect(ergebnis).toEqual({ id: 'gleich' });
    expect(prisma.rollenzuweisung.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
