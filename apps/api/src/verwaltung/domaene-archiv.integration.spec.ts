import { PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';
import { DomaeneArchivService } from './domaene-archiv.service';
import { RechteService } from '../rechte/rechte.service';
import { PrismaService } from '../prisma/prisma.service';
import { erstelleTestOrg, raeumeTestOrgAuf } from '../test-support/integration-org';

/**
 * Domänen-Archivierung gegen echte DB in einer ISOLIERTEN Test-Organisation.
 * Legt eigene Domänen/Personen an, prüft Verwaisung/„behalten"/Historie-Erhalt
 * und Wiederbeleben und räumt am Ende die komplette Organisation ab. Bewusst
 * NICHT gegen die geteilte „Demo-Gemeinschaft", damit deren Seed-Zählungen stabil
 * bleiben und die Suite beliebig oft wiederholbar ist.
 */
describe('DomaeneArchivService (isolierte Test-Org, voller Flow)', () => {
  const prisma = new PrismaClient();
  const rechte = new RechteService(prisma as unknown as PrismaService);
  const service = new DomaeneArchivService(
    prisma as unknown as PrismaService,
    rechte,
  );
  const heuteDatum = zuDatum(heute());

  let organisationId: string;
  let adminId: string;
  // Dauerhaft aktive Ziel-Domäne für „behalten_in_domaene".
  let zielDomaeneId: string;

  beforeAll(async () => {
    const org = await erstelleTestOrg(prisma, 'archiv');
    organisationId = org.organisationId;
    adminId = org.adminId;
    zielDomaeneId = await tempDomaene('Ziel');
  });

  afterAll(async () => {
    await raeumeTestOrgAuf(prisma, organisationId);
    await prisma.$disconnect();
  });

  async function tempPerson(suffix: string): Promise<string> {
    const p = await prisma.person.create({
      data: {
        organisationId,
        name: `Temp ${suffix}`,
        nutzername: `temp.${suffix}.${Date.now()}`,
        loginEmail: `temp.${suffix}.${Date.now()}@demo.test`,
        angelegtAm: heuteDatum,
      },
    });
    return p.id;
  }

  async function tempDomaene(
    name: string,
    elternDomaeneId?: string,
  ): Promise<string> {
    const k = await prisma.domaene.create({
      data: {
        organisationId,
        name: `${name} ${Date.now()}`,
        ziel: 'Test-Domäne',
        tasks: ['Test'],
        typ: 'arbeitsdomaene',
        gegruendetAm: heuteDatum,
        ...(elternDomaeneId ? { elternDomaeneId } : {}),
      },
    });
    return k.id;
  }

  it('Vorschau erkennt das Alleinmitglied als verwaisend', async () => {
    const kId = await tempDomaene('Verwaisung');
    const pId = await tempPerson('allein');
    await prisma.mitgliedschaft.create({
      data: { personId: pId, domaeneId: kId, gueltigAb: heuteDatum },
    });

    const vorschau = await service.vorschau(organisationId, kId);
    expect(vorschau.verwaisende.map((v) => v.personId)).toContain(pId);
    // Die aktive Ziel-Domäne ist als mögliche Ziel-Domäne dabei.
    expect(vorschau.zielDomaenen.some((z) => z.id === zielDomaeneId)).toBe(true);
    expect(vorschau.hatAktiveUnterDomaenen).toBe(false);
  });

  it('behalten_in_domaene legt Mitgliedschaft in Ziel-Domäne an, Domäne wird archiviert', async () => {
    const kId = await tempDomaene('Behalten');
    const pId = await tempPerson('umzug');
    await prisma.mitgliedschaft.create({
      data: { personId: pId, domaeneId: kId, gueltigAb: heuteDatum },
    });

    await service.archivieren(organisationId, kId, {
      entscheidungen: [
        { personId: pId, aktion: 'behalten_in_domaene', zielDomaeneId },
      ],
    });

    // Neue gültige Mitgliedschaft in der Ziel-Domäne.
    const neu = await prisma.mitgliedschaft.findFirst({
      where: { personId: pId, domaeneId: zielDomaeneId, gueltigBis: null },
    });
    expect(neu).not.toBeNull();
    // Person bleibt aktiv (nur umgezogen).
    const person = await prisma.person.findUniqueOrThrow({ where: { id: pId } });
    expect(person.aktiv).toBe(true);
    // Domäne ist archiviert.
    const domaene = await prisma.domaene.findUniqueOrThrow({ where: { id: kId } });
    expect(domaene.archiviert).toBe(true);
    expect(domaene.aktiv).toBe(false);
    expect(domaene.archiviertAm).not.toBeNull();
    // Alte Mitgliedschaft in der archivierten Domäne ist beendet.
    const alt = await prisma.mitgliedschaft.findFirstOrThrow({
      where: { personId: pId, domaeneId: kId },
    });
    expect(alt.gueltigBis).not.toBeNull();
  });

  it('Domäne mit Beschluss wird archiviert, der Beschluss bleibt erhalten', async () => {
    const kId = await tempDomaene('MitHistorie');
    const pId = await tempPerson('historie');
    await prisma.mitgliedschaft.create({
      data: { personId: pId, domaeneId: kId, gueltigAb: heuteDatum },
    });
    const vorschlag = await prisma.vorschlag.create({
      data: {
        domaeneId: kId,
        erfasstVonId: adminId,
        titel: 'Testvorschlag',
        inhalt: 'Inhalt',
        governanceTyp: 'operativ',
        status: 'entschieden',
        datum: heuteDatum,
      },
    });
    const beschluss = await prisma.beschluss.create({
      data: {
        vorschlagId: vorschlag.id,
        erfasstVonId: adminId,
        inhalt: 'Beschlossen',
        befristung: 'unbefristet',
        gueltigkeitStatus: 'gueltig',
        gueltigAb: heuteDatum,
        datum: heuteDatum,
      },
    });

    await service.archivieren(organisationId, kId, {
      entscheidungen: [
        { personId: pId, aktion: 'behalten_in_domaene', zielDomaeneId },
      ],
    });

    // Beschluss und Vorschlag bleiben als Historie erhalten.
    const nochDa = await prisma.beschluss.findUnique({ where: { id: beschluss.id } });
    expect(nochDa).not.toBeNull();
    const domaene = await prisma.domaene.findUniqueOrThrow({ where: { id: kId } });
    expect(domaene.archiviert).toBe(true);
    expect(domaene.archiviertAm).not.toBeNull();
  });

  it('wiederbeleben macht eine archivierte Domäne wieder aktiv', async () => {
    const kId = await tempDomaene('Wiederbelebung');
    // Ohne Mitglieder -> keine Verwaisung, direkt archivierbar.
    await service.archivieren(organisationId, kId, { entscheidungen: [] });
    let domaene = await prisma.domaene.findUniqueOrThrow({ where: { id: kId } });
    expect(domaene.archiviert).toBe(true);

    await service.wiederbeleben(organisationId, kId);
    domaene = await prisma.domaene.findUniqueOrThrow({ where: { id: kId } });
    expect(domaene.archiviert).toBe(false);
    expect(domaene.aktiv).toBe(true);
    expect(domaene.archiviertAm).toBeNull();
  });

  it('Archivieren mit aktiver Unter-Domäne wird blockiert (Regel A9)', async () => {
    const elternId = await tempDomaene('Eltern');
    await tempDomaene('Kind', elternId); // aktive Unter-Domäne

    await expect(
      service.archivieren(organisationId, elternId, { entscheidungen: [] }),
    ).rejects.toMatchObject({ status: 422 });
    const eltern = await prisma.domaene.findUniqueOrThrow({ where: { id: elternId } });
    expect(eltern.archiviert).toBe(false);
  });
});
