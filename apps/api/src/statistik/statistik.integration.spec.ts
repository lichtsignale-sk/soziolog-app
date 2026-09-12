import { PrismaClient } from '@prisma/client';
import { StatistikService } from './statistik.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Prüft die Aggregationen gegen die Seed-Daten (Genossenschaft Solawi Rheintal).
 * Alle Zahlen werden live aus echten Datensätzen aggregiert; die Statistik zeigt
 * nur nicht-archivierte Domänen mit mindestens einem aktiven Mitglied.
 */
describe('StatistikService (Seed-Daten)', () => {
  const prisma = new PrismaClient();
  const service = new StatistikService(prisma as unknown as PrismaService);
  let organisationId: string;

  beforeAll(async () => {
    const org = await prisma.organisation.findFirstOrThrow({
      where: { name: 'Genossenschaft Solawi Rheintal' },
    });
    organisationId = org.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('nutzerProDomaene: echte aktive Mitgliederzahlen je Domäne', async () => {
    const res = await service.nutzerProDomaene(organisationId);
    // 10 nicht-archivierte Domänen haben aktive Mitglieder.
    expect(res).toHaveLength(10);
    // 8 aus dem Grund-Seed + der Demo-Zugang, der im Allgemeinen Kreis sitzt.
    expect(res.find((r) => r.domaeneName === 'Allgemeiner Kreis')?.anzahl).toBe(9);
    expect(res.find((r) => r.domaeneName === 'Öffentlichkeitskreis')?.anzahl).toBe(4);
    expect(res.find((r) => r.domaeneName === 'Verteilkreis')?.anzahl).toBe(3);
    // Dritte Ebene (Unter-Unterdomänen).
    expect(res.find((r) => r.domaeneName === 'Saatgut-AG')?.anzahl).toBe(4);
    expect(res.find((r) => r.domaeneName === 'Abholstation Stadtmitte')?.anzahl).toBe(3);
  });

  it('bedenkenProMonat: aus echten Bedenken-Daten aggregiert (Summe = Anzahl Bedenken)', async () => {
    const res = await service.bedenkenProMonat(organisationId);
    const summe = res.reduce((acc, m) => acc + m.anzahl, 0);
    expect(summe).toBe(19);
    expect(res.find((m) => m.monat === '2026-01')?.anzahl).toBe(1);
    expect(res.find((m) => m.monat === '2026-06')?.anzahl).toBe(5);
    // Januar bis August lückenlos — die Demo bricht nicht mitten im Jahr ab.
    expect(res.map((m) => m.monat)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08',
    ]);
  });

  it('domaeneEinwaendeBedenken: Öffentlichkeitskreis 3 Bedenken + 1 leicht/1 schwer', async () => {
    const res = await service.domaeneEinwaendeBedenken(organisationId);
    const oeff = res.find((r) => r.domaeneName === 'Öffentlichkeitskreis');
    expect(oeff).toMatchObject({ bedenken: 3, einwaendeLeicht: 1, einwaendeSchwer: 1 });
  });

  it('domaeneEntscheidungen: echte Beschluss-Zahlen je Domäne', async () => {
    const res = await service.domaeneEntscheidungen(organisationId);
    expect(res.find((r) => r.domaeneName === 'Allgemeiner Kreis')?.beschluesse).toBe(4);
    // Finanzkreis: 3 aus dem Grund-Seed + 4 aus der Lebenszyklus-Demo.
    expect(res.find((r) => r.domaeneName === 'Finanzkreis')?.beschluesse).toBe(7);
    // Summe aller Entscheidungen = 29 (echte Beschlüsse).
    const summe = res.reduce((acc, r) => acc + r.beschluesse, 0);
    expect(summe).toBe(29);
  });
});
