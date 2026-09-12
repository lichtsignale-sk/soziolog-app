import { PrismaClient } from '@prisma/client';
import { heute, zuDatum, MAX_UNTER_UNTER_DOMAENEN } from '@soziolog/shared';
import { DomaeneService } from './domaene.service';
import { PrismaService } from '../prisma/prisma.service';
import { erstelleTestOrg, raeumeTestOrgAuf } from '../test-support/integration-org';

/**
 * Tiefen- und Breitenregel des Domänen-Baums gegen echte DB in einer ISOLIERTEN
 * Test-Organisation:
 *  - Haupt- (Ebene 0) und Unterdomänen (Ebene 1) sind unbegrenzt,
 *  - eine Unterdomäne hat höchstens MAX_UNTER_UNTER_DOMAENEN Unter-Unterdomänen,
 *  - eine vierte Ebene gibt es nicht.
 * Bewusst NICHT gegen die geteilte „Demo-Gemeinschaft", damit deren Seed-Zählungen
 * stabil bleiben.
 */
describe('DomaeneService – Tiefen-/Breitenbegrenzung (isolierte Test-Org)', () => {
  const prisma = new PrismaClient();
  const service = new DomaeneService(prisma as unknown as PrismaService);
  const heuteDatum = zuDatum(heute());

  let organisationId: string;
  // Drei Mitglieder für die Startbesetzung (Gründungsregel a) jeder Domäne.
  const mitglieder: string[] = [];

  beforeAll(async () => {
    const org = await erstelleTestOrg(prisma, 'tiefe');
    organisationId = org.organisationId;
    for (const rolle of ['a', 'b', 'c']) {
      const p = await prisma.person.create({
        data: {
          organisationId,
          name: `Mitglied ${rolle}`,
          nutzername: `mit.${rolle}.${Date.now()}`,
          loginEmail: `mit.${rolle}.${Date.now()}@test.local`,
          angelegtAm: heuteDatum,
        },
      });
      mitglieder.push(p.id);
    }
  });

  afterAll(async () => {
    await raeumeTestOrgAuf(prisma, organisationId);
    await prisma.$disconnect();
  });

  /** Legt eine Domäne über den echten Validierungspfad an, gibt die Id zurück. */
  async function anlegen(name: string, elternDomaeneId?: string): Promise<string> {
    const d = await service.erstellen(organisationId, {
      name,
      ziel: 'Testziel',
      tasks: ['Aufgabe'],
      typ: 'arbeitsdomaene',
      elternDomaeneId,
      besetzung: [
        { personId: mitglieder[0], rolleTyp: 'moderation' },
        { personId: mitglieder[1], rolleTyp: 'logbuchfuehrer' },
        { personId: mitglieder[2] },
      ],
    });
    return d.id;
  }

  it('erlaubt beliebig viele Unterdomänen und genau MAX_UNTER_UNTER_DOMAENEN je Ebene', async () => {
    const haupt = await anlegen('Haupt');
    const unter = await anlegen('Unter', haupt);

    // Genau die erlaubte Höchstzahl an Unter-Unterdomänen anlegen.
    for (let i = 0; i < MAX_UNTER_UNTER_DOMAENEN; i += 1) {
      await expect(anlegen(`UnterUnter ${i}`, unter)).resolves.toBeTruthy();
    }

    // Eine weitere (vierte) muss scheitern.
    await expect(anlegen('UnterUnter zu viel', unter)).rejects.toThrow(
      /höchstens 3 Unter-Unterdomänen/,
    );
  });

  it('verbietet eine vierte Domänenebene', async () => {
    const haupt = await anlegen('Haupt2');
    const unter = await anlegen('Unter2', haupt);
    const unterUnter = await anlegen('UnterUnter2', unter);

    await expect(anlegen('Vierte Ebene', unterUnter)).rejects.toThrow(
      /keine vierte Domänenebene/,
    );
  });

  it('zählt archivierte Unter-Unterdomänen nicht mit', async () => {
    const haupt = await anlegen('Haupt3');
    const unter = await anlegen('Unter3', haupt);
    const ids: string[] = [];
    for (let i = 0; i < MAX_UNTER_UNTER_DOMAENEN; i += 1) {
      ids.push(await anlegen(`UU3 ${i}`, unter));
    }
    // Eine archivieren -> Platz für eine neue.
    await prisma.domaene.update({
      where: { id: ids[0] },
      data: { archiviert: true, archiviertAm: heuteDatum },
    });
    await expect(anlegen('UU3 ersatz', unter)).resolves.toBeTruthy();
  });
});
