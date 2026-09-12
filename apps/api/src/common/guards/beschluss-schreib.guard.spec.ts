import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BeschlussSchreibGuard } from './beschluss-schreib.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RechteService } from '../../rechte/rechte.service';

function ctx(person: unknown, id = 'b1'): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ person, params: { id } }) }),
  } as unknown as ExecutionContext;
}

function baue(beschluss: unknown, istProtokollfuehrer: boolean) {
  const prisma = {
    beschluss: { findUnique: jest.fn().mockResolvedValue(beschluss) },
  } as unknown as PrismaService;
  const rechte = {
    istProtokollfuehrer: jest.fn().mockResolvedValue(istProtokollfuehrer),
  } as unknown as RechteService;
  return new BeschlussSchreibGuard(prisma, rechte);
}

describe('BeschlussSchreibGuard', () => {
  it('404 wenn der Beschluss fehlt', async () => {
    const guard = baue(null, false);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: false })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('erlaubt den Protokollführer des Domaene', async () => {
    const guard = baue({ vorschlag: { domaeneId: 'k1' } }, true);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: false })),
    ).resolves.toBe(true);
  });

  it('403 für Nicht-Protokollführer', async () => {
    const guard = baue({ vorschlag: { domaeneId: 'k1' } }, false);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: false })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lässt Admins durch', async () => {
    const guard = baue({ vorschlag: { domaeneId: 'k1' } }, false);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: true })),
    ).resolves.toBe(true);
  });
});
