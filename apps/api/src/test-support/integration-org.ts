import type { PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';

/**
 * Hilfen für Integrationstests, die Daten SCHREIBEN. Solche Tests laufen gegen
 * eine echte DB, die sich alle Suiten teilen. Damit sie die geteilten Seed-Daten
 * der „Demo-Gemeinschaft" nicht verfälschen (z. B. die exakten Zählungen der
 * Statistik-, Personen- und Mitglieder-Tests), legt jeder schreibende Test seine
 * EIGENE, vollständig isolierte Organisation an und räumt sie danach wieder ab.
 *
 * Vorteile gegenüber „temporäre Kreise im Kernkreis anlegen":
 *  - Die Demo-Zählungen bleiben unberührt – die Suite ist beliebig oft
 *    wiederholbar, ohne `prisma migrate reset` + Reseed dazwischen.
 *  - Selbst ein abgebrochener Lauf hinterlässt höchstens eine fremde Test-Org;
 *    die (nach organisationId gefilterten) Seed-Tests bleiben davon unberührt.
 */

export interface TestOrg {
  organisationId: string;
  adminId: string;
  adminName: string;
}

let zaehler = 0;
/** Global eindeutiges Token (nutzername/loginEmail sind DB-weit unique). */
function eindeutig(): string {
  zaehler += 1;
  return `${Date.now().toString(36)}-${process.pid}-${zaehler}`;
}

/** Legt eine isolierte Test-Organisation mit einem Admin an. */
export async function erstelleTestOrg(
  prisma: PrismaClient,
  praefix = 'test',
): Promise<TestOrg> {
  const heuteDatum = zuDatum(heute());
  const token = eindeutig();
  const org = await prisma.organisation.create({
    data: {
      name: `Test-Org ${praefix} ${token}`,
      setupAbgeschlossen: true,
      angelegtAm: heuteDatum,
    },
  });
  const admin = await prisma.person.create({
    data: {
      organisationId: org.id,
      name: `Admin ${praefix}`,
      nutzername: `admin.${praefix}.${token}`,
      loginEmail: `admin.${praefix}.${token}@test.local`,
      istAdmin: true,
      angelegtAm: heuteDatum,
    },
  });
  return { organisationId: org.id, adminId: admin.id, adminName: admin.name };
}

/**
 * Löscht die Test-Organisation samt ALLEN abhängigen Datensätzen – FK-sicher
 * (Kinder vor Eltern) und ausschließlich innerhalb dieser Organisation. So ist
 * das Aufräumen unabhängig davon, welche Testmethode was angelegt hat.
 */
export async function raeumeTestOrgAuf(
  prisma: PrismaClient,
  organisationId: string,
): Promise<void> {
  const domaenen = await prisma.domaene.findMany({
    where: { organisationId },
    select: { id: true },
  });
  const domaeneIds = domaenen.map((d) => d.id);
  const personen = await prisma.person.findMany({
    where: { organisationId },
    select: { id: true },
  });
  const personIds = personen.map((p) => p.id);
  const vorschlaege = await prisma.vorschlag.findMany({
    where: { domaeneId: { in: domaeneIds } },
    select: { id: true },
  });
  const vorschlagIds = vorschlaege.map((v) => v.id);

  // Benachrichtigungen: erst die Empfänge (FK Person, kein Cascade), dann die
  // Benachrichtigungen selbst (referenzieren Beschluss/Korrektur/Domäne).
  await prisma.benachrichtigungEmpfang.deleteMany({
    where: { personId: { in: personIds } },
  });
  await prisma.benachrichtigung.deleteMany({
    where: {
      OR: [
        { domaeneId: { in: domaeneIds } },
        { betrifftBeschluss: { vorschlagId: { in: vorschlagIds } } },
        { betrifftKorrektur: { beantragtVonId: { in: personIds } } },
      ],
    },
  });

  // Korrekturanträge (FK Person, kein Cascade).
  await prisma.korrekturantrag.deleteMany({
    where: { beantragtVonId: { in: personIds } },
  });

  // Beschlüsse vor Vorschlägen (kein Cascade); Bedenken/Einwand cascaden mit dem
  // Vorschlag.
  await prisma.beschluss.deleteMany({
    where: { vorschlagId: { in: vorschlagIds } },
  });
  await prisma.vorschlag.deleteMany({ where: { id: { in: vorschlagIds } } });

  // Mitgliedschaften/Rollen (nach Person ODER Domäne der Org).
  await prisma.rollenzuweisung.deleteMany({
    where: { OR: [{ personId: { in: personIds } }, { domaeneId: { in: domaeneIds } }] },
  });
  await prisma.mitgliedschaft.deleteMany({
    where: { OR: [{ personId: { in: personIds } }, { domaeneId: { in: domaeneIds } }] },
  });

  await prisma.sitzung.deleteMany({ where: { domaeneId: { in: domaeneIds } } });
  await prisma.einladung.deleteMany({ where: { personId: { in: personIds } } });
  await prisma.passwortReset.deleteMany({ where: { personId: { in: personIds } } });

  // Domänen: Selbstreferenz (elternDomaene) vorher lösen, dann löschen.
  await prisma.domaene.updateMany({
    where: { id: { in: domaeneIds } },
    data: { elternDomaeneId: null },
  });
  await prisma.domaene.deleteMany({ where: { id: { in: domaeneIds } } });

  await prisma.person.deleteMany({ where: { id: { in: personIds } } });
  await prisma.organisation.delete({ where: { id: organisationId } });
}
