import { UnprocessableEntityException } from '@nestjs/common';
import { MitgliedschaftService } from './mitgliedschaft.service';
import type { RechteService } from '../rechte/rechte.service';

function baueService() {
  const prisma = {
    mitgliedschaft: { findUnique: jest.fn(), update: jest.fn() },
    rollenzuweisung: { updateMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const rechte = {
    hatAndereGueltigeMitgliedschaft: jest.fn(),
    istTeilhabender: jest.fn(),
  };
  const service = new MitgliedschaftService(
    prisma as never,
    rechte as unknown as RechteService,
  );
  return { service, prisma, rechte };
}

describe('MitgliedschaftService.beenden', () => {
  it('422 wenn es die letzte gültige Mitgliedschaft wäre', async () => {
    const { service, prisma, rechte } = baueService();
    prisma.mitgliedschaft.findUnique.mockResolvedValue({
      id: 'm1',
      personId: 'p1',
      domaeneId: 'k1',
      gueltigBis: null,
    });
    rechte.hatAndereGueltigeMitgliedschaft.mockResolvedValue(false);

    await expect(service.beenden('m1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('beendet über gueltigBis (kein hartes Löschen) und schließt Rollen', async () => {
    const { service, prisma, rechte } = baueService();
    prisma.mitgliedschaft.findUnique.mockResolvedValue({
      id: 'm1',
      personId: 'p1',
      domaeneId: 'k1',
      gueltigBis: null,
    });
    rechte.hatAndereGueltigeMitgliedschaft.mockResolvedValue(true);

    await service.beenden('m1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // update (gueltigBis setzen) statt delete
    expect(prisma.mitgliedschaft.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' } }),
    );
    const updateData = prisma.mitgliedschaft.update.mock.calls[0][0].data;
    expect(updateData.gueltigBis).toBeInstanceOf(Date);
  });
});
