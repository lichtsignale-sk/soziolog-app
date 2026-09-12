import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { VorgangService } from './vorgang.service';
import { zuDatum } from '@soziolog/shared';

function baueService() {
  const prisma = {
    vorschlag: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    domaene: { findUnique: jest.fn() },
    sitzung: { findFirst: jest.fn() },
    bedenken: { create: jest.fn() },
    einwand: { create: jest.fn() },
    beschluss: { create: jest.fn() },
    mitgliedschaft: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const benachrichtigung = { erstelleFuerEmpfaenger: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new VorgangService(prisma as never, benachrichtigung as never),
    prisma,
    benachrichtigung,
  };
}

const tag = zuDatum('2026-07-04');

/** Vorschlag mit Einträgen für den Lese-Mapper (holeVorschlag). */
function vorschlagMitEintraegen(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v1',
    domaeneId: 'k1',
    titel: 'Titel',
    inhalt: 'Inhalt',
    governanceTyp: 'operativ',
    status: 'offen',
    datum: tag,
    erfasstVonId: 'admin-person-id',
    domaene: { name: 'Kernkreis' },
    erfasstVon: { name: 'Admin Muster' },
    bedenken: [
      { id: 'b1', inhalt: 'Sorge', datum: tag, erfasstVonId: 'admin-person-id', vorschlagId: 'v1' },
    ],
    einwaende: [],
    beschluss: null,
    ...overrides,
  };
}

describe('VorgangService.fuegeEinwand', () => {
  it('422 bei schwerwiegend ohne Integration', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({ id: 'v1', datum: tag });
    await expect(
      service.fuegeEinwand('p1', 'v1', {
        inhalt: 'schwer',
        schweregrad: 'schwerwiegend',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(prisma.einwand.create).not.toHaveBeenCalled();
  });
});

describe('VorgangService.fuegeBedenken – Datum-Vererbung', () => {
  it('nutzt das Vorschlagsdatum als Default', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique
      .mockResolvedValueOnce({ id: 'v1', datum: tag }) // ladeVorschlagOderFehler
      .mockResolvedValueOnce(vorschlagMitEintraegen()); // holeVorschlag
    await service.fuegeBedenken('p1', 'v1', { inhalt: 'Sorge' });
    expect(prisma.bedenken.create.mock.calls[0][0].data.datum).toEqual(tag);
  });

  it('erlaubt ein eigenes Datum (späterer Nachtrag)', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique
      .mockResolvedValueOnce({ id: 'v1', datum: tag })
      .mockResolvedValueOnce(vorschlagMitEintraegen());
    await service.fuegeBedenken('p1', 'v1', { inhalt: 'Sorge', datum: '2026-06-01' });
    expect(prisma.bedenken.create.mock.calls[0][0].data.datum).toEqual(
      zuDatum('2026-06-01'),
    );
  });
});

describe('VorgangService.erstelleBeschluss – Regeln', () => {
  it('422 wenn ein schwerwiegender Einwand ohne Integration offen ist', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      beschluss: null,
      einwaende: [{ schweregrad: 'schwerwiegend', integration: null }],
    });
    await expect(
      service.erstelleBeschluss('p1', 'v1', {
        inhalt: 'x',
        befristung: 'unbefristet',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('422 bei befristet ohne Überprüfungsdatum', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      beschluss: null,
      einwaende: [],
    });
    await expect(
      service.erstelleBeschluss('p1', 'v1', { inhalt: 'x', befristung: 'befristet' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('422 bei unbefristet mit Überprüfungsdatum', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      beschluss: null,
      einwaende: [],
    });
    await expect(
      service.erstelleBeschluss('p1', 'v1', {
        inhalt: 'x',
        befristung: 'unbefristet',
        ueberpruefungsdatum: '2026-12-31',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('409 wenn bereits ein Beschluss existiert', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue({
      id: 'v1',
      beschluss: { id: 'best1' },
      einwaende: [],
    });
    await expect(
      service.erstelleBeschluss('p1', 'v1', { inhalt: 'x', befristung: 'unbefristet' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('legt bei gültigen Daten Beschluss an und setzt Status entschieden', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique
      .mockResolvedValueOnce({ id: 'v1', beschluss: null, einwaende: [] })
      .mockResolvedValueOnce(
        vorschlagMitEintraegen({
          status: 'entschieden',
          beschluss: {
            id: 'best1',
            inhalt: 'B',
            notiz: null,
            befristung: 'unbefristet',
            ueberpruefungsdatum: null,
            gueltigkeitStatus: 'gueltig',
            gueltigAb: tag,
            gueltigBis: null,
            datum: tag,
          },
        }),
      );

    const dto = await service.erstelleBeschluss('p1', 'v1', {
      inhalt: 'B',
      befristung: 'unbefristet',
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(dto.status).toBe('entschieden');
    expect(dto.beschluss?.erfasstVonLabel).toBe('Logbuchführer Kernkreis');
  });
});

describe('VorgangService.holeVorschlag – Anonymität', () => {
  it('gibt echten Namen beim Vorschlag, aber Bedenken ohne jeden Urheber aus', async () => {
    const { service, prisma } = baueService();
    prisma.vorschlag.findUnique.mockResolvedValue(vorschlagMitEintraegen());

    const dto = await service.holeVorschlag('v1');
    expect(dto.erfasstVonName).toBe('Admin Muster');
    // Kein erfasstVonId / Klarname im ausgelieferten Bedenken.
    expect(Object.keys(dto.bedenken[0])).toEqual(['id', 'inhalt', 'datum']);
    expect(JSON.stringify(dto)).not.toContain('erfasstVonId');
    expect(JSON.stringify(dto)).not.toContain('admin-person-id');
  });
});
