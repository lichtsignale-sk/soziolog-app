import { ConflictException } from '@nestjs/common';
import { GueltigkeitService } from './gueltigkeit.service';

function baueService() {
  const prisma = {
    beschluss: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    benachrichtigung: { deleteMany: jest.fn() },
  };
  return { service: new GueltigkeitService(prisma as never), prisma };
}

describe('GueltigkeitService.giltAmStichtag – Grenzfälle', () => {
  const { service } = baueService();

  it('gilt exakt am gueltigAb (inklusive)', () => {
    expect(service.giltAmStichtag('2026-07-04', null, '2026-07-04')).toBe(true);
  });

  it('gilt NICHT exakt am gueltigBis (exklusiv)', () => {
    expect(service.giltAmStichtag('2026-07-01', '2026-07-04', '2026-07-04')).toBe(false);
  });

  it('gilt am Tag vor gueltigBis', () => {
    expect(service.giltAmStichtag('2026-07-01', '2026-07-04', '2026-07-03')).toBe(true);
  });

  it('gilt nicht vor gueltigAb', () => {
    expect(service.giltAmStichtag('2026-07-04', null, '2026-07-03')).toBe(false);
  });

  it('gilt unbegrenzt bei gueltigBis=null', () => {
    expect(service.giltAmStichtag('2020-01-01', null, '2030-12-31')).toBe(true);
  });

  it('rechnet über Monats-/Jahreswechsel ohne Verschiebung', () => {
    // Ablösung am Jahreswechsel: alt bis 2026-01-01, neu ab 2026-01-01.
    expect(service.giltAmStichtag('2025-12-01', '2026-01-01', '2025-12-31')).toBe(true);
    expect(service.giltAmStichtag('2025-12-01', '2026-01-01', '2026-01-01')).toBe(false);
    expect(service.giltAmStichtag('2026-01-01', null, '2026-01-01')).toBe(true);
  });
});

describe('GueltigkeitService.beendeBeschluss', () => {
  it('409, wenn der Beschluss bereits ersetzt ist', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'b1',
      gueltigkeitStatus: 'ersetzt',
    });
    await expect(service.beendeBeschluss('b1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.beschluss.update).not.toHaveBeenCalled();
  });

  it('setzt beendet + gueltigBis bei gültigem Beschluss', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.findUnique.mockResolvedValue({
      id: 'b1',
      gueltigkeitStatus: 'gueltig',
    });
    await service.beendeBeschluss('b1');
    const data = prisma.beschluss.update.mock.calls[0][0].data;
    expect(data.gueltigkeitStatus).toBe('beendet');
    expect(data.gueltigBis).toBeInstanceOf(Date);
    // Erledigte Fällig-Benachrichtigungen des Beschlusses werden entfernt.
    expect(prisma.benachrichtigung.deleteMany).toHaveBeenCalledWith({
      where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: 'b1' },
    });
  });
});

describe('GueltigkeitService.bestaetigeBeschluss', () => {
  it('409, wenn der Beschluss bereits ersetzt ist', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.findUnique.mockResolvedValue({ id: 'b1', gueltigkeitStatus: 'ersetzt' });
    await expect(
      service.bestaetigeBeschluss('b1', { befristung: 'unbefristet' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.beschluss.update).not.toHaveBeenCalled();
  });

  it('setzt Status zurück auf gueltig und entfristet (unbefristet)', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.findUnique.mockResolvedValue({ id: 'b1', gueltigkeitStatus: 'in_ueberpruefung' });
    await service.bestaetigeBeschluss('b1', { befristung: 'unbefristet' });
    const data = prisma.beschluss.update.mock.calls[0][0].data;
    expect(data.gueltigkeitStatus).toBe('gueltig');
    expect(data.befristung).toBe('unbefristet');
    expect(data.ueberpruefungsdatum).toBeNull();
    expect(prisma.benachrichtigung.deleteMany).toHaveBeenCalled();
  });

  it('setzt bei befristet ein neues Überprüfungsdatum (derselbe Beschluss)', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.findUnique.mockResolvedValue({ id: 'b1', gueltigkeitStatus: 'in_ueberpruefung' });
    await service.bestaetigeBeschluss('b1', {
      befristung: 'befristet',
      ueberpruefungsdatum: '2999-12-31',
    });
    const data = prisma.beschluss.update.mock.calls[0][0].data;
    expect(data.gueltigkeitStatus).toBe('gueltig');
    expect(data.befristung).toBe('befristet');
    expect(data.ueberpruefungsdatum).toBeInstanceOf(Date);
    // Es bleibt derselbe Beschluss (keine neue id, kein gueltigAb/gueltigBis-Reset).
    expect(prisma.beschluss.update.mock.calls[0][0].where).toEqual({ id: 'b1' });
  });
});

describe('GueltigkeitService – fällige Überprüfungen', () => {
  it('markiereFaellige filtert befristet+gueltig+ueberpruefungsdatum lte und gibt Anzahl', async () => {
    const { service, prisma } = baueService();
    prisma.beschluss.updateMany.mockResolvedValue({ count: 2 });

    const anzahl = await service.markiereFaelligeAlsInUeberpruefung('2026-07-04');

    expect(anzahl).toBe(2);
    const where = prisma.beschluss.updateMany.mock.calls[0][0].where;
    expect(where.befristung).toBe('befristet');
    expect(where.gueltigkeitStatus).toBe('gueltig');
    expect(where.ueberpruefungsdatum.lte).toBeInstanceOf(Date);
    expect(
      prisma.beschluss.updateMany.mock.calls[0][0].data.gueltigkeitStatus,
    ).toBe('in_ueberpruefung');
  });
});
