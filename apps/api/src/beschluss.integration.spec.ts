import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Seed-Daten: Beschluss', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Demo-Beschluss ist gültig und ohne Ablaufdatum', async () => {
    const beschluss = await prisma.beschluss.findFirst({
      where: { gueltigkeitStatus: 'gueltig' },
    });
    expect(beschluss).not.toBeNull();
    expect(beschluss!.gueltigkeitStatus).toBe('gueltig');
    expect(beschluss!.gueltigBis).toBeNull();
    expect(beschluss!.befristung).toBe('unbefristet');
  });

  it('offener Vorschlag hat keinen Beschluss', async () => {
    const vorschlag = await prisma.vorschlag.findFirst({
      where: { status: 'offen' },
      include: { beschluss: true },
    });
    expect(vorschlag).not.toBeNull();
    expect(vorschlag!.beschluss).toBeNull();
    expect(vorschlag!.status).toBe('offen');
  });

  it('Organisation hat setupAbgeschlossen=true', async () => {
    const org = await prisma.organisation.findFirst({
      where: { name: 'Genossenschaft Solawi Rheintal' },
    });
    expect(org).not.toBeNull();
    expect(org!.setupAbgeschlossen).toBe(true);
  });
});
