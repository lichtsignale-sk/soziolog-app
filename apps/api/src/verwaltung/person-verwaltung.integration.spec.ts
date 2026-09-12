import { PrismaClient } from '@prisma/client';
import { PersonVerwaltungService } from './person-verwaltung.service';
import { EinladungService } from './einladung.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * PersonVerwaltungService.alle() gegen die Seed-Daten (Solawi Rheintal): die
 * Personen mit abgeleitetem Status/Berechtigung und ihren Domänen/Rollen.
 */
describe('PersonVerwaltungService.alle (Seed-Daten)', () => {
  const prisma = new PrismaClient();
  const service = new PersonVerwaltungService(
    prisma as unknown as PrismaService,
    new EinladungService(prisma as unknown as PrismaService),
  );

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('listet die Seed-Personen mit Status/Berechtigung und Rollen', async () => {
    const org = await prisma.organisation.findFirstOrThrow({
      where: { name: 'Genossenschaft Solawi Rheintal' },
    });

    const personen = await service.alle(org.id);
    // 17 Personen: 14 aktiv (inkl. Demo-Zugang), 1 deaktiviert (Thomas),
    // 2 eingeladen (Nadia/Robert).
    expect(personen).toHaveLength(17);

    const lena = personen.find((p) => p.loginEmail === 'lena.brandt@solawi-rheintal.de');
    const marek = personen.find((p) => p.loginEmail === 'marek.kowalski@solawi-rheintal.de');
    const jamal = personen.find((p) => p.loginEmail === 'jamal.reza@solawi-rheintal.de');
    const thomas = personen.find((p) => p.loginEmail === 'thomas.vogt@solawi-rheintal.de');
    const nadia = personen.find((p) => p.loginEmail === 'nadia.hoffmann@solawi-rheintal.de');

    expect(lena?.istAdmin).toBe(true);
    expect(lena?.status).toBe('aktiv');
    expect(lena?.berechtigung).toBe('Administrativ');

    expect(marek?.berechtigung).toBe('Protokollierend'); // Logbuchführend irgendwo
    expect(jamal?.berechtigung).toBe('Teilhabend');

    expect(thomas?.status).toBe('deaktiviert');
    expect(nadia?.status).toBe('eingeladen');
    expect(nadia?.berechtigung).toBeNull();
  });
});
