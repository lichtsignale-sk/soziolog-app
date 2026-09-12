import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { KorrekturService } from './korrektur.service';

function baueService() {
  const prisma = {
    korrekturantrag: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    vorschlag: { findUnique: jest.fn(), update: jest.fn() },
    bedenken: { findUnique: jest.fn(), update: jest.fn() },
    einwand: { findUnique: jest.fn(), update: jest.fn() },
    beschluss: { findUnique: jest.fn(), update: jest.fn() },
    person: { findMany: jest.fn().mockResolvedValue([]) },
    benachrichtigung: { create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    // $transaction führt den Callback mit demselben Mock als tx aus.
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  const benachrichtigung = {
    erstelleFuerEmpfaenger: jest.fn(),
    entferneKorrekturBeantragt: jest.fn(),
  };
  return {
    service: new KorrekturService(prisma as never, benachrichtigung as never),
    prisma,
    benachrichtigung,
  };
}

describe('KorrekturService.antragStellen – Feld-Whitelist (Sicherheitsgrenze)', () => {
  it('lehnt ein nicht-korrigierbares Feld mit 422 ab und legt nichts an', async () => {
    const { service, prisma } = baueService();
    await expect(
      service.antragStellen('p1', 'org1', {
        zielTyp: 'vorschlag',
        zielId: 'v1',
        feld: 'status',
        neuerInhalt: 'entschieden',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.korrekturantrag.create).not.toHaveBeenCalled();
    // Ziel wird gar nicht erst aufgelöst.
    expect(prisma.vorschlag.findUnique).not.toHaveBeenCalled();
  });

  it('lehnt auch ein Gültigkeitsfeld beim Beschluss ab (422)', async () => {
    const { service } = baueService();
    await expect(
      service.antragStellen('p1', 'org1', {
        zielTyp: 'beschluss',
        zielId: 'b1',
        feld: 'gueltigBis',
        neuerInhalt: '2027-01-01',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('KorrekturService.bestaetigen – Nebenläufigkeit (atomarer Statuswechsel)', () => {
  const antrag = {
    id: 'k1',
    zielTyp: 'vorschlag',
    zielId: 'v1',
    feld: 'titel',
    neuerInhalt: 'Neuer Titel',
    beantragtVonId: 'p1',
  };

  it('erste Bestätigung wirkt: Feld wird genau einmal geschrieben', async () => {
    const { service, prisma } = baueService();
    prisma.korrekturantrag.findUnique.mockResolvedValue({ id: 'k1' });
    prisma.korrekturantrag.updateMany.mockResolvedValue({ count: 1 });
    prisma.korrekturantrag.findUniqueOrThrow.mockResolvedValue(antrag);
    prisma.vorschlag.findUnique.mockResolvedValue(null); // zielKontext -> null (egal, .catch)

    await service.bestaetigen('k1', 'admin1');

    expect(prisma.vorschlag.update).toHaveBeenCalledTimes(1);
    expect(prisma.vorschlag.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { titel: 'Neuer Titel' },
    });
  });

  it('zweite (gleichzeitige) Bestätigung -> 409, keine erneute Feldschreibung', async () => {
    const { service, prisma } = baueService();
    prisma.korrekturantrag.findUnique.mockResolvedValue({ id: 'k1' });
    // Der Antrag ist nicht mehr offen -> bedingtes updateMany trifft 0 Zeilen.
    prisma.korrekturantrag.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.bestaetigen('k1', 'admin2')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.vorschlag.update).not.toHaveBeenCalled();
  });
});
