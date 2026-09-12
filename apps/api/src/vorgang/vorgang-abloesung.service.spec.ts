import { BadRequestException, ConflictException } from '@nestjs/common';
import { VorgangService } from './vorgang.service';
import { heute, zuDatum } from '@soziolog/shared';

// Datumsunabhängig: der Service nutzt heute(); der Test muss denselben Tag prüfen.
const tag = zuDatum(heute());

function baueService() {
  const prisma = {
    vorschlag: { findUnique: jest.fn(), update: jest.fn() },
    beschluss: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    domaene: { findUnique: jest.fn() },
    mitgliedschaft: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const benachrichtigung = {
    erstelleFuerEmpfaenger: jest.fn().mockResolvedValue(undefined),
    entferneUeberpruefungFaellig: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new VorgangService(prisma as never, benachrichtigung as never),
    prisma,
    benachrichtigung,
  };
}

/** Voller Vorschlag mit Beschluss für den Rückgabe-Mapper (holeVorschlag). */
function vollerVorschlag() {
  return {
    id: 'v1',
    domaeneId: 'k1',
    titel: 'B-Vorschlag',
    inhalt: 'I',
    governanceTyp: 'operativ',
    status: 'entschieden',
    datum: tag,
    erfasstVonId: 'p1',
    domaene: { name: 'Kernkreis' },
    erfasstVon: { name: 'Person Eins' },
    bedenken: [],
    einwaende: [],
    beschluss: {
      id: 'neu',
      inhalt: 'B',
      notiz: null,
      befristung: 'unbefristet',
      ueberpruefungsdatum: null,
      gueltigkeitStatus: 'gueltig',
      gueltigAb: tag,
      gueltigBis: null,
      datum: tag,
    },
  };
}

describe('VorgangService – Ablösung', () => {
  it('setzt beim Ablösen die Spannen (neu.ersetztBeschlussId + alt.update)', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique
      .mockResolvedValueOnce({ id: 'v1', domaeneId: 'k1', beschluss: null, einwaende: [] })
      .mockResolvedValueOnce(vollerVorschlag());
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'alt',
      vorschlagId: 'v0',
      vorschlag: { domaeneId: 'k1' },
      gueltigkeitStatus: 'gueltig',
    });

    await service.erstelleBeschluss('p1', 'v1', {
      inhalt: 'B',
      befristung: 'unbefristet',
      ersetztBeschlussId: 'alt',
    });

    // create + vorschlag.update + alt.update = 3 Operationen in der Transaktion
    const ops = prisma.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(3);
    expect(prisma.beschluss.create.mock.calls[0][0].data.ersetztBeschlussId).toBe('alt');
    const altUpdate = prisma.beschluss.update.mock.calls[0][0];
    expect(altUpdate.where).toEqual({ id: 'alt' });
    expect(altUpdate.data.gueltigkeitStatus).toBe('ersetzt');
    expect(altUpdate.data.gueltigBis).toEqual(tag);
  });

  it('409 beim Ablösen eines bereits abgelösten Beschlusses', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      domaeneId: 'k1',
      beschluss: null,
      einwaende: [],
    });
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'alt',
      vorschlagId: 'v0',
      vorschlag: { domaeneId: 'k1' },
      gueltigkeitStatus: 'ersetzt',
    });

    await expect(
      service.erstelleBeschluss('p1', 'v1', {
        inhalt: 'B',
        befristung: 'unbefristet',
        ersetztBeschlussId: 'alt',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('409 beim Ablösen eines Beschlusses aus fremdem Domaene', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      domaeneId: 'k1',
      beschluss: null,
      einwaende: [],
    });
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'alt',
      vorschlagId: 'v0',
      vorschlag: { domaeneId: 'ANDERER' },
      gueltigkeitStatus: 'gueltig',
    });

    await expect(
      service.erstelleBeschluss('p1', 'v1', {
        inhalt: 'B',
        befristung: 'unbefristet',
        ersetztBeschlussId: 'alt',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 bei Selbstbezug (alt gehört zum selben Vorschlag)', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      domaeneId: 'k1',
      beschluss: null,
      einwaende: [],
    });
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'alt',
      vorschlagId: 'v1',
      vorschlag: { domaeneId: 'k1' },
      gueltigkeitStatus: 'gueltig',
    });

    await expect(
      service.erstelleBeschluss('p1', 'v1', {
        inhalt: 'B',
        befristung: 'unbefristet',
        ersetztBeschlussId: 'alt',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
