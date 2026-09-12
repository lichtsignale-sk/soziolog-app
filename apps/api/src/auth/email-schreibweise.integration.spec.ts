import { PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  erstelleTestOrg,
  raeumeTestOrgAuf,
  type TestOrg,
} from '../test-support/integration-org';

/**
 * Die E-Mail-Suche gegen eine ECHTE Datenbank (12.09.2026).
 *
 * Der Unit-Test prüft, welche Abfrage gestellt wird; nur hier zeigt sich,
 * dass `lower()` in Postgres wirklich trifft und ein `_` KEIN Platzhalter
 * ist. Eigene Testorganisation, nie der Seed.
 */
describe('AuthService — E-Mail ohne Rücksicht auf Groß/Klein (Datenbank)', () => {
  const prisma = new PrismaClient();
  const mail = { sendePasswortReset: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    { signAsync: jest.fn() } as never,
    { get: (_: string, vorgabe?: string) => vorgabe } as never,
    mail as never,
  );
  const kennung = `${Date.now().toString(36)}${process.pid}`;
  let org: TestOrg;

  async function person(loginEmail: string, zusatz: string): Promise<string> {
    const angelegt = await prisma.person.create({
      data: {
        organisationId: org.organisationId,
        name: `Schreibweise ${zusatz}`,
        nutzername: `schreibweise.${zusatz}.${kennung}`,
        loginEmail,
        angelegtAm: zuDatum(heute()),
      },
    });
    return angelegt.id;
  }

  async function resetsVon(personId: string): Promise<number> {
    return prisma.passwortReset.count({ where: { personId } });
  }

  beforeAll(async () => {
    org = await erstelleTestOrg(prisma, 'schreibweise');
  });

  beforeEach(() => mail.sendePasswortReset.mockClear());

  afterAll(async () => {
    // Räumt auch die Rücksetz-Zeilen ab.
    await raeumeTestOrgAuf(prisma, org.organisationId);
    await prisma.$disconnect();
  });

  it('findet „Samuel@…", wenn „samuel@…" gespeichert ist — und schreibt an die gespeicherte', async () => {
    const adresse = `samuel.${kennung}@beispiel.test`;
    const id = await person(adresse, 'samuel');

    await service.passwortVergessen(`  Samuel.${kennung}@BEISPIEL.test `);

    expect(await resetsVon(id)).toBe(1);
    expect(mail.sendePasswortReset).toHaveBeenCalledWith(adresse, expect.any(String));
  });

  it('behandelt „_" als Zeichen, nicht als Platzhalter', async () => {
    const id = await person(`max_muster.${kennung}@test.local`, 'unterstrich');

    await service.passwortVergessen(`maxXmuster.${kennung}@test.local`);

    expect(await resetsVon(id)).toBe(0);
    expect(mail.sendePasswortReset).not.toHaveBeenCalled();
  });

  it('wählt bei zwei Schreibweisen die exakte und bei keiner exakten keine', async () => {
    const klein = await person(`doppelt.${kennung}@test.local`, 'klein');
    const gross = await person(`Doppelt.${kennung}@test.local`, 'gross');

    await service.passwortVergessen(`Doppelt.${kennung}@test.local`);
    expect(await resetsVon(gross)).toBe(1);
    expect(await resetsVon(klein)).toBe(0);

    await service.passwortVergessen(`DOPPELT.${kennung}@TEST.LOCAL`);
    expect(await resetsVon(gross)).toBe(1);
    expect(await resetsVon(klein)).toBe(0);
  });
});
