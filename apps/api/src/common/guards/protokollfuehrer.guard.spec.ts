import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ProtokollfuehrerGuard } from './protokollfuehrer.guard';
import type { RechteService } from '../../rechte/rechte.service';

function ctx(person: unknown, params: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ person, params }) }),
  } as unknown as ExecutionContext;
}

describe('ProtokollfuehrerGuard', () => {
  it('lässt Admins ohne Domaene-Rolle durch', async () => {
    const rechte = { istProtokollfuehrer: jest.fn() } as unknown as RechteService;
    const guard = new ProtokollfuehrerGuard(rechte);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: true })),
    ).resolves.toBe(true);
    expect(rechte.istProtokollfuehrer).not.toHaveBeenCalled();
  });

  it('erlaubt Protokollführer des Domaene', async () => {
    const rechte = {
      istProtokollfuehrer: jest.fn().mockResolvedValue(true),
    } as unknown as RechteService;
    const guard = new ProtokollfuehrerGuard(rechte);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: false }, { domaeneId: 'k1' })),
    ).resolves.toBe(true);
    expect(rechte.istProtokollfuehrer).toHaveBeenCalledWith('p1', 'k1');
  });

  it('403 für Nicht-Protokollführer in fremdem Domaene', async () => {
    const rechte = {
      istProtokollfuehrer: jest.fn().mockResolvedValue(false),
    } as unknown as RechteService;
    const guard = new ProtokollfuehrerGuard(rechte);
    await expect(
      guard.canActivate(ctx({ id: 'p1', istAdmin: false }, { domaeneId: 'k1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
