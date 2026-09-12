import { NotFoundException } from '@nestjs/common';
import { DomaeneLeseService } from './domaene-lese.service';

function baueService() {
  const prisma = {
    domaene: { findMany: jest.fn(), findFirst: jest.fn() },
    vorschlag: { findMany: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
    mitgliedschaft: { findMany: jest.fn() },
  };
  return { service: new DomaeneLeseService(prisma as never), prisma };
}

// Domänen ohne gespeicherte Zähler – diese werden live aus den Vorschlägen
// aggregiert.
const domaenen = [
  { id: 'k1', name: 'Kernkreis', ziel: 'Z', tasks: ['D'], typ: 'dauerdomaene', elternDomaeneId: null, aktiv: true, archiviert: false },
  { id: 'k2', name: 'Finanzen', ziel: 'Z2', tasks: ['D2'], typ: 'dauerdomaene', elternDomaeneId: 'k1', aktiv: true, archiviert: false },
];

describe('DomaeneLeseService.alleDomaenen', () => {
  it('liefert Hierarchie + live aggregierte Zählungen, begrenzt auf die Organisation', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findMany.mockResolvedValue(domaenen);
    // Kernkreis: 1 entschieden + 3 offen; Finanzen: keine Vorschläge.
    prisma.vorschlag.groupBy.mockResolvedValue([
      { domaeneId: 'k1', status: 'entschieden', _count: { _all: 1 } },
      { domaeneId: 'k1', status: 'offen', _count: { _all: 3 } },
    ]);

    const ergebnis = await service.alleDomaenen('org1');

    // Org-Scope wird an Prisma weitergereicht.
    expect(prisma.domaene.findMany.mock.calls[0][0].where).toEqual({ organisationId: 'org1' });
    expect(prisma.vorschlag.groupBy.mock.calls[0][0].where).toEqual({
      domaene: { organisationId: 'org1' },
    });

    const kern = ergebnis.find((k) => k.id === 'k1')!;
    expect(kern.elternDomaeneId).toBeNull();
    expect(kern.anzahlBeschluesse).toBe(1); // entschiedene Vorschläge
    expect(kern.anzahlOffeneEinwaende).toBe(3); // offene Vorschläge

    const fin = ergebnis.find((k) => k.id === 'k2')!;
    expect(fin.elternDomaeneId).toBe('k1'); // Verschachtelung durchgereicht
    expect(fin.anzahlBeschluesse).toBe(0); // ohne Vorschläge -> 0
    expect(fin.anzahlOffeneEinwaende).toBe(0);
  });
});

describe('DomaeneLeseService.domaeneDetail', () => {
  it('liefert den Eltern-Domäne-Namen + live aggregierte Zähler', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue({
      ...domaenen[1],
      elternDomaene: { name: 'Kernkreis' },
    });
    // erst entschiedene, dann offene Vorschläge.
    prisma.vorschlag.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const detail = await service.domaeneDetail('org1', 'k2');
    expect(detail.elternDomaeneName).toBe('Kernkreis');
    expect(detail.name).toBe('Finanzen');
    expect(detail.anzahlBeschluesse).toBe(2);
    expect(detail.anzahlOffeneEinwaende).toBe(1);
  });

  it('404 bei unbekanntem Domaene', async () => {
    const { service, prisma } = baueService();
    prisma.domaene.findFirst.mockResolvedValue(null);
    await expect(service.domaeneDetail('org1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DomaeneLeseService.mitgliederDesDomaene', () => {
  it('liefert nur Name/Id, alphabetisch sortiert', async () => {
    const { service, prisma } = baueService();
    prisma.mitgliedschaft.findMany.mockResolvedValue([
      { person: { id: 'p2', name: 'Zora Beispiel', avatarColor: null, avatarTextColor: null } },
      { person: { id: 'p1', name: 'Anna Muster', avatarColor: null, avatarTextColor: null } },
    ]);

    const ergebnis = await service.mitgliederDesDomaene('org1', 'k1');

    expect(prisma.mitgliedschaft.findMany.mock.calls[0][0].where).toEqual({
      domaeneId: 'k1',
      gueltigBis: null,
      domaene: { organisationId: 'org1' },
      person: { aktiv: true },
    });
    expect(ergebnis).toEqual([
      { id: 'p1', name: 'Anna Muster', avatarColor: null, avatarTextColor: null },
      { id: 'p2', name: 'Zora Beispiel', avatarColor: null, avatarTextColor: null },
    ]);
  });
});
