import { PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';
import { GueltigkeitService } from './gueltigkeit.service';
import { VorgangService } from '../vorgang/vorgang.service';
import { BenachrichtigungService } from '../benachrichtigung/benachrichtigung.service';
import { UeberpruefungScheduler } from '../benachrichtigung/ueberpruefung.scheduler';
import { PrismaService } from '../prisma/prisma.service';
import { erstelleTestOrg, raeumeTestOrgAuf } from '../test-support/integration-org';
import type { MailService } from '../mail/mail.service';

/**
 * Lebenszyklus befristeter Beschlüsse gegen echte DB in einer ISOLIERTEN Org:
 * fällig (Scheduler) → erneut bestätigen (derselbe Beschluss, Fällig-
 * Benachrichtigung entfernt, nächster Zyklus benachrichtigt erneut) sowie
 * ersetzen (Ablösungskette) und beenden.
 */
describe('Beschluss-Lebenszyklus (isolierte Test-Org)', () => {
  const prisma = new PrismaClient();
  const mailStub = { sendeBenachrichtigung: async () => {} } as unknown as MailService;
  const p = prisma as unknown as PrismaService;
  const benachrichtigung = new BenachrichtigungService(p, mailStub);
  const gueltigkeit = new GueltigkeitService(p);
  const vorgang = new VorgangService(p, benachrichtigung);
  const scheduler = new UeberpruefungScheduler(p, gueltigkeit, benachrichtigung);
  const heuteDatum = zuDatum(heute());

  let organisationId: string;
  let adminId: string;
  let domaeneId: string;

  beforeAll(async () => {
    const org = await erstelleTestOrg(prisma, 'lebenszyklus');
    organisationId = org.organisationId;
    adminId = org.adminId;
    const domaene = await prisma.domaene.create({
      data: {
        organisationId, name: 'Zyklus-Kreis', ziel: 'Test', tasks: ['Test'],
        typ: 'arbeitsdomaene', gegruendetAm: heuteDatum,
      },
    });
    domaeneId = domaene.id;
    await prisma.mitgliedschaft.create({
      data: { personId: adminId, domaeneId, gueltigAb: heuteDatum },
    });
  });

  afterAll(async () => {
    await raeumeTestOrgAuf(prisma, organisationId);
    await prisma.$disconnect();
  });

  /** Legt einen befristeten Beschluss (fällig heute, gültig) an; gibt Ids zurück. */
  async function befristeterBeschluss(titel: string) {
    const v = await prisma.vorschlag.create({
      data: {
        domaeneId, erfasstVonId: adminId, titel, inhalt: 'x',
        governanceTyp: 'operativ', status: 'entschieden', datum: heuteDatum,
      },
    });
    const b = await prisma.beschluss.create({
      data: {
        vorschlagId: v.id, erfasstVonId: adminId, inhalt: 'Gilt befristet',
        befristung: 'befristet', ueberpruefungsdatum: heuteDatum,
        gueltigkeitStatus: 'gueltig', gueltigAb: heuteDatum, datum: heuteDatum,
      },
    });
    return { vorschlagId: v.id, beschlussId: b.id };
  }

  it('bestätigen: derselbe Beschluss, Fällig-Benachrichtigung entfernt, nächster Zyklus benachrichtigt erneut', async () => {
    const { beschlussId } = await befristeterBeschluss('Erneut bestätigen');

    // Fällig -> in Überprüfung + eine Benachrichtigung.
    await scheduler.verarbeiteFaellige(heute());
    expect(
      await prisma.benachrichtigung.count({
        where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
      }),
    ).toBe(1);

    // Erneut bestätigen – wieder befristet, neue Frist heute (für den Folgezyklus).
    await gueltigkeit.bestaetigeBeschluss(beschlussId, {
      befristung: 'befristet',
      ueberpruefungsdatum: heute(),
    });
    const nach = await prisma.beschluss.findUniqueOrThrow({ where: { id: beschlussId } });
    expect(nach.gueltigkeitStatus).toBe('gueltig'); // derselbe Beschluss, wieder gültig
    // Alte Fällig-Benachrichtigung ist entfernt.
    expect(
      await prisma.benachrichtigung.count({
        where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
      }),
    ).toBe(0);

    // Nächster Zyklus (gleiche neue Frist) benachrichtigt wieder.
    await scheduler.verarbeiteFaellige(heute());
    expect(
      await prisma.benachrichtigung.count({
        where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
      }),
    ).toBe(1);
  });

  it('ersetzen: Neufassungs-Vorschlag löst den alten Beschluss ab (Kette)', async () => {
    const { beschlussId: altId } = await befristeterBeschluss('Alt');

    const neuVorschlag = await vorgang.erstelleVorschlag(adminId, domaeneId, {
      titel: 'Neufassung', inhalt: 'Ersetzt den alten', governanceTyp: 'operativ',
      ersetztBeschlussId: altId,
    });
    await vorgang.erstelleBeschluss(adminId, neuVorschlag.id, {
      inhalt: 'Neuer Wortlaut', befristung: 'unbefristet',
    });

    const alt = await prisma.beschluss.findUniqueOrThrow({ where: { id: altId } });
    expect(alt.gueltigkeitStatus).toBe('ersetzt');
    expect(alt.gueltigBis).not.toBeNull();
    const neu = await prisma.beschluss.findFirstOrThrow({
      where: { vorschlagId: neuVorschlag.id },
    });
    expect(neu.ersetztBeschlussId).toBe(altId);
  });

  it('beenden: Status beendet + gueltigBis heute', async () => {
    const { beschlussId } = await befristeterBeschluss('Beenden');
    await gueltigkeit.beendeBeschluss(beschlussId);
    const nach = await prisma.beschluss.findUniqueOrThrow({ where: { id: beschlussId } });
    expect(nach.gueltigkeitStatus).toBe('beendet');
    expect(nach.gueltigBis).not.toBeNull();
  });

  it('bestätigen abgelehnt, wenn Beschluss bereits ersetzt ist', async () => {
    const { beschlussId } = await befristeterBeschluss('Schon ersetzt');
    await prisma.beschluss.update({
      where: { id: beschlussId }, data: { gueltigkeitStatus: 'ersetzt', gueltigBis: heuteDatum },
    });
    await expect(
      gueltigkeit.bestaetigeBeschluss(beschlussId, { befristung: 'unbefristet' }),
    ).rejects.toThrow(/bestätigt werden/);
  });

});
