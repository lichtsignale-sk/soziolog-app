import { PrismaClient } from '@prisma/client';
import { KorrekturService } from './korrektur.service';
import { PrismaService } from '../prisma/prisma.service';
import { erstelleTestOrg, raeumeTestOrgAuf } from '../test-support/integration-org';
import type { BenachrichtigungService } from '../benachrichtigung/benachrichtigung.service';

// Benachrichtigungen sind in diesem Flow-Test nicht im Fokus (eigener Test).
const benachrichtigungStub = {
  erstelleFuerEmpfaenger: async () => {},
  entferneKorrekturBeantragt: async () => {},
} as unknown as BenachrichtigungService;

/**
 * Voller Korrektur-Flow gegen echte DB in einer ISOLIERTEN Test-Organisation:
 * eigener Test-Vorschlag in einer Domäne „Kernkreis" dieser Org, Antrag auf
 * `titel`, Bestätigung -> Zielfeld geändert, Änderungslog zeigt Rollen-Label
 * (Antragsteller) + Admin-Klarname (Bestätiger). Am Ende wird die komplette
 * Organisation abgeräumt. Bewusst NICHT gegen die geteilte „Demo-Gemeinschaft",
 * damit deren Seed-Zählungen (Statistik/Personen) stabil bleiben.
 */
describe('KorrekturService (isolierte Test-Org, voller Flow)', () => {
  const prisma = new PrismaClient();
  const service = new KorrekturService(
    prisma as unknown as PrismaService,
    benachrichtigungStub,
  );

  let organisationId: string;
  let adminId: string;
  let adminName: string;
  let vorschlagId: string;

  beforeAll(async () => {
    const org = await erstelleTestOrg(prisma, 'korrektur');
    organisationId = org.organisationId;
    adminId = org.adminId;
    adminName = org.adminName;

    // Domäne heißt „Kernkreis" – das Rollen-Label leitet sich aus dem
    // Domänennamen ab (`Logbuchführer <Domäne>`), nicht aus den Seed-Daten.
    const domaene = await prisma.domaene.create({
      data: {
        organisationId,
        name: 'Kernkreis',
        ziel: 'Test-Domäne für Korrekturen',
        tasks: ['Test'],
        typ: 'dauerdomaene',
      },
    });

    const v = await prisma.vorschlag.create({
      data: {
        domaeneId: domaene.id,
        erfasstVonId: adminId,
        titel: 'Korrektur-Test Ausgangstitel',
        inhalt: 'Ausgangsinhalt',
        governanceTyp: 'operativ',
        status: 'offen',
      },
    });
    vorschlagId = v.id;
  });

  afterAll(async () => {
    await raeumeTestOrgAuf(prisma, organisationId);
    await prisma.$disconnect();
  });

  it('Antrag -> Bestätigung schreibt den neuen Titel in den Vorschlag', async () => {
    const { id } = await service.antragStellen(adminId, organisationId, {
      zielTyp: 'vorschlag',
      zielId: vorschlagId,
      feld: 'titel',
      neuerInhalt: 'Korrigierter Titel',
      begruendung: 'Tippfehler',
    });

    // In der Admin-Queue sichtbar (mit alt->neu und Rollen-Label).
    const offene = await service.offeneAntraege(organisationId);
    const inQueue = offene.find((a) => a.id === id);
    expect(inQueue).toBeDefined();
    expect(inQueue!.alterInhalt).toBe('Korrektur-Test Ausgangstitel');
    expect(inQueue!.neuerInhalt).toBe('Korrigierter Titel');
    expect(inQueue!.beantragtVonName).toBe(adminName);
    expect(inQueue!.beantragtVonLabel).toBe('Logbuchführend · Kernkreis');

    await service.bestaetigen(id, adminId);

    const v = await prisma.vorschlag.findUniqueOrThrow({
      where: { id: vorschlagId },
    });
    expect(v.titel).toBe('Korrigierter Titel');
  });

  it('Änderungslog zeigt Name des Antragstellers und Admin-Klarnamen', async () => {
    const log = await service.aenderungslog(organisationId);
    const eintrag = log.find((e) => e.vorschlagId === vorschlagId);
    expect(eintrag).toBeDefined();
    expect(eintrag!.feld).toBe('titel');
    expect(eintrag!.alterInhalt).toBe('Korrektur-Test Ausgangstitel');
    expect(eintrag!.neuerInhalt).toBe('Korrigierter Titel');
    expect(eintrag!.beantragtVonName).toBe(adminName);
    expect(eintrag!.bestaetigtVonName).toBe(adminName);
    expect(eintrag!.entschiedenAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
