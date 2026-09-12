import { PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';
import { BenachrichtigungService } from './benachrichtigung.service';
import { UeberpruefungScheduler } from './ueberpruefung.scheduler';
import { GueltigkeitService } from '../gueltigkeit/gueltigkeit.service';
import { PrismaService } from '../prisma/prisma.service';
import { erstelleTestOrg, raeumeTestOrgAuf } from '../test-support/integration-org';
import type { MailService } from '../mail/mail.service';

/**
 * Scheduler gegen echte DB: befristeter Beschluss (fällig heute) in einer
 * ISOLIERTEN Test-Domäne -> genau eine Benachrichtigung an alle Teilhabenden,
 * idempotent, Lesestand 0/N. E-Mail-Versand wird gestubbt.
 *
 * Bewusst NICHT gegen die geteilten Seed-Daten (Kernkreis): der Test legt seine
 * eigene Organisation samt Domäne und Mitgliedern an, damit die Statistik- und
 * Personen-Tests ihre exakten Seed-Zählungen behalten – auch bei wiederholten
 * Läufen der Suite.
 */
describe('UeberpruefungScheduler (isolierte Test-Domäne)', () => {
  const prisma = new PrismaClient();
  const mailStub = {
    sendeBenachrichtigung: async () => {},
  } as unknown as MailService;
  const benachrichtigung = new BenachrichtigungService(
    prisma as unknown as PrismaService,
    mailStub,
  );
  const gueltigkeit = new GueltigkeitService(prisma as unknown as PrismaService);
  const scheduler = new UeberpruefungScheduler(
    prisma as unknown as PrismaService,
    gueltigkeit,
    benachrichtigung,
  );
  const heuteDatum = zuDatum(heute());

  let organisationId: string;
  let adminId: string;
  let domaeneId: string;
  let beschlussId: string;
  let teilhabendeAnzahl: number;

  beforeAll(async () => {
    const org = await erstelleTestOrg(prisma, 'benachrichtigung');
    organisationId = org.organisationId;
    adminId = org.adminId;

    const domaene = await prisma.domaene.create({
      data: {
        organisationId,
        name: 'Prüfkreis',
        ziel: 'Test-Domäne für Überprüfungen',
        tasks: ['Test'],
        typ: 'arbeitsdomaene',
        gegruendetAm: heuteDatum,
      },
    });
    domaeneId = domaene.id;

    // Drei Teilhabende (inkl. Admin) – die erwartete Empfängermenge.
    const mitglieder = [adminId];
    for (const suffix of ['b', 'c']) {
      const p = await prisma.person.create({
        data: {
          organisationId,
          name: `Mitglied ${suffix}`,
          nutzername: `mitglied.${suffix}.${Date.now()}`,
          loginEmail: `mitglied.${suffix}.${Date.now()}@test.local`,
          angelegtAm: heuteDatum,
        },
      });
      mitglieder.push(p.id);
    }
    await prisma.mitgliedschaft.createMany({
      data: mitglieder.map((personId) => ({ personId, domaeneId, gueltigAb: heuteDatum })),
    });
    teilhabendeAnzahl = mitglieder.length;

    const vorschlag = await prisma.vorschlag.create({
      data: {
        domaeneId,
        erfasstVonId: adminId,
        titel: 'Befristete Regel',
        inhalt: 'x',
        governanceTyp: 'operativ',
        status: 'entschieden',
        datum: heuteDatum,
      },
    });
    const beschluss = await prisma.beschluss.create({
      data: {
        vorschlagId: vorschlag.id,
        erfasstVonId: adminId,
        inhalt: 'Gilt befristet',
        befristung: 'befristet',
        ueberpruefungsdatum: heuteDatum,
        gueltigkeitStatus: 'gueltig',
        gueltigAb: heuteDatum,
        datum: heuteDatum,
      },
    });
    beschlussId = beschluss.id;
  });

  afterAll(async () => {
    await raeumeTestOrgAuf(prisma, organisationId);
    await prisma.$disconnect();
  });

  it('erzeugt genau eine Benachrichtigung mit Empfängen = Teilhabende, idempotent', async () => {
    const neu1 = await scheduler.verarbeiteFaellige(heute());
    expect(neu1).toBeGreaterThanOrEqual(1);

    const benachrichtigungen = await prisma.benachrichtigung.findMany({
      where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
      include: { empfaenger: true },
    });
    expect(benachrichtigungen).toHaveLength(1);
    expect(benachrichtigungen[0].empfaenger).toHaveLength(teilhabendeAnzahl);
    expect(teilhabendeAnzahl).toBeGreaterThan(0);

    // Zweiter Lauf: keine Duplikate.
    await scheduler.verarbeiteFaellige(heute());
    const nachher = await prisma.benachrichtigung.count({
      where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
    });
    expect(nachher).toBe(1);

    // Lesestand: noch niemand hat gelesen -> auffällig.
    const stand = await benachrichtigung.lesestand(benachrichtigungen[0].id);
    expect(stand.gesamt).toBe(teilhabendeAnzahl);
    expect(stand.gelesen).toBe(0);
    expect(stand.auffaellig).toBe(true);
  });
});
