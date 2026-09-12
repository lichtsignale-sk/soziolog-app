import { PrismaClient } from '@prisma/client';
import { DomaeneService } from './domaene.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DomaeneService.mitgliederDetail() gegen die Seed-Daten (Solawi Rheintal): der
 * Allgemeine Kreis zeigt Lena (delegierte), Sofia (logbuchfuehrer) mit ihren Rollen.
 */
describe('DomaeneService.mitgliederDetail (Seed-Daten)', () => {
  const prisma = new PrismaClient();
  const service = new DomaeneService(prisma as unknown as PrismaService);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('liefert die Mitglieder des Allgemeinen Kreises mit ihren Rollen', async () => {
    const org = await prisma.organisation.findFirstOrThrow({
      where: { name: 'Genossenschaft Solawi Rheintal' },
    });
    const allg = await prisma.domaene.findFirstOrThrow({
      where: { organisationId: org.id, name: 'Allgemeiner Kreis' },
    });

    const detail = await service.mitgliederDetail(org.id, allg.id);
    expect(detail.domaeneName).toBe('Allgemeiner Kreis');

    const lena = detail.mitglieder.find((m) => m.nutzername === 'lena.brandt');
    const sofia = detail.mitglieder.find((m) => m.nutzername === 'sofia.adler');
    expect(lena?.rollen.map((r) => r.rolleTyp)).toContain('delegierte');
    expect(sofia?.rollen.map((r) => r.rolleTyp)).toContain('logbuchfuehrer');
  });

  it('404 für einen fremden/nicht existierenden Domaene', async () => {
    const org = await prisma.organisation.findFirstOrThrow({
      where: { name: 'Genossenschaft Solawi Rheintal' },
    });
    await expect(
      service.mitgliederDetail(org.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Domäne nicht gefunden.');
  });
});
