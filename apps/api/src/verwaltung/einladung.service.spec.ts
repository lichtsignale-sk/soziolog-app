import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { EinladungService } from './einladung.service';
import { heute, datumPlusTage, zuDatum } from '@soziolog/shared';

jest.mock('argon2');

function baueService() {
  const prisma = {
    einladung: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    person: { update: jest.fn() },
  };
  return { service: new EinladungService(prisma as never), prisma };
}

const gueltigeEinladung = {
  id: 'e1',
  personId: 'p1',
  laeuftAbAm: zuDatum(datumPlusTage(heute(), 3)),
  eingeloestAm: null,
  person: { name: 'A', loginEmail: 'a@demo.test' },
};

describe('EinladungService.pruefe', () => {
  it('liefert Basisdaten bei gültiger Einladung', async () => {
    const { service, prisma } = baueService();
    prisma.einladung.findFirst.mockResolvedValue(gueltigeEinladung);
    expect(await service.pruefe('tok')).toEqual({
      name: 'A',
      loginEmail: 'a@demo.test',
    });
  });

  it('wirft 404 bei unbekanntem Token', async () => {
    const { service, prisma } = baueService();
    prisma.einladung.findFirst.mockResolvedValue(null);
    await expect(service.pruefe('tok')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('wirft bei abgelaufener Einladung', async () => {
    const { service, prisma } = baueService();
    prisma.einladung.findFirst.mockResolvedValue({
      ...gueltigeEinladung,
      laeuftAbAm: zuDatum('2020-01-01'),
    });
    await expect(service.pruefe('tok')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EinladungService.aktiviere', () => {
  it('setzt Passwort und markiert einmalig als eingelöst', async () => {
    const { service, prisma } = baueService();
    prisma.einladung.findFirst.mockResolvedValue(gueltigeEinladung);
    prisma.einladung.updateMany.mockResolvedValue({ count: 1 });
    (argon2.hash as jest.Mock).mockResolvedValue('neuer-hash');

    await service.aktiviere('tok', 'sicher12');

    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { passwortHash: 'neuer-hash', aktiv: true },
    });
  });

  it('lehnt bereits eingelöste Einladung ab (Einmalgebrauch)', async () => {
    const { service, prisma } = baueService();
    prisma.einladung.findFirst.mockResolvedValue(gueltigeEinladung);
    prisma.einladung.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.aktiviere('tok', 'sicher12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.person.update).not.toHaveBeenCalled();
  });
});
