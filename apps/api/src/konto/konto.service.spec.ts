import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { KontoService } from './konto.service';

jest.mock('argon2');
const argonVerify = argon2.verify as jest.Mock;
const argonHash = argon2.hash as jest.Mock;

function baueService() {
  const prisma = {
    person: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const service = new KontoService(prisma as never);
  return { service, prisma };
}

describe('KontoService.aktualisiere', () => {
  it('übernimmt nur die erlaubten Felder – niemals istAdmin', async () => {
    const { service, prisma } = baueService();
    prisma.person.update.mockResolvedValue({
      id: 'p1',
      name: 'Neu',
      nutzername: 'admin.demo',
      loginEmail: 'admin@demo.test',
      istAdmin: false,
      benachrichtigungenAktiv: true,
    });

    // Ein untergeschobenes istAdmin darf NICHT in die update-Daten gelangen.
    await service.aktualisiere('p1', {
      name: 'Neu',
      istAdmin: true,
    } as never);

    const daten = prisma.person.update.mock.calls[0][0].data;
    expect(daten).toEqual({ name: 'Neu' });
    expect(daten).not.toHaveProperty('istAdmin');
  });

  it('meldet 409 bei Kollision von nutzername/loginEmail', async () => {
    const { service, prisma } = baueService();
    prisma.person.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '5.22.0',
        meta: { target: ['nutzername'] },
      }),
    );

    await expect(
      service.aktualisiere('p1', { nutzername: 'schon.da' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('KontoService.aenderePasswort', () => {
  it('lehnt bei falschem aktuellem Passwort ab', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      passwortHash: 'hash',
    });
    argonVerify.mockResolvedValue(false);

    await expect(
      service.aenderePasswort('p1', 'falsch', 'neuesGeheim1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('setzt bei korrektem aktuellem Passwort einen neuen Hash', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({
      id: 'p1',
      passwortHash: 'hash',
    });
    argonVerify.mockResolvedValue(true);
    argonHash.mockResolvedValue('neuer-hash');
    prisma.person.update.mockResolvedValue({});

    await service.aenderePasswort('p1', 'demo1234', 'neuesGeheim1');

    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({ passwortHash: 'neuer-hash' }),
    });
  });
});

/**
 * Regressionstest: Ein Passwortwechsel liess bestehende Sitzungs-JWTs
 * unberuehrt; sie galten weitere sieben Tage.
 */
describe('KontoService.aenderePasswort — Sitzungen beenden', () => {
  it('zaehlt sitzungsGeneration hoch und haelt den Tag fest', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ id: 'p1', passwortHash: 'hash' });
    argonVerify.mockResolvedValue(true);
    argonHash.mockResolvedValue('neuer-hash');
    prisma.person.update.mockResolvedValue({});

    await service.aenderePasswort('p1', 'demo1234', 'neuesGeheim1');

    const daten = prisma.person.update.mock.calls[0][0].data;
    expect(daten.sitzungsGeneration).toEqual({ increment: 1 });
    expect(daten.passwortGeaendertAm).toBeDefined();
  });
});
