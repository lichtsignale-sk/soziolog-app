import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SitzungGuard } from './sitzung.guard';

const person = {
  id: 'p1',
  organisationId: 'o1',
  name: 'Admin',
  nutzername: 'admin.demo',
  loginEmail: 'admin@demo.test',
  istAdmin: true,
  benachrichtigungenAktiv: true,
  aktiv: true,
  sitzungsGeneration: 3,
};

function baue(nutzlast: Record<string, unknown> | null) {
  const jwt = {
    verifyAsync: jest.fn(async () => {
      if (nutzlast === null) throw new Error('ungültig');
      return nutzlast;
    }),
  };
  const config = { get: jest.fn(() => 'geheim') };
  const prisma = { person: { findUnique: jest.fn().mockResolvedValue(person) } };
  const guard = new SitzungGuard(jwt as never, config as never, prisma as never);
  const req: Record<string, unknown> = { cookies: { sitzung: 'ein.jwt' } };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { guard, ctx, req, prisma };
}

/**
 * Regressionstests zu A.6: Vor der Einführung von `sitzungsGeneration` blieb
 * ein Sitzungs-JWT nach Passwortwechsel und Reset sieben Tage gültig.
 */
describe('SitzungGuard — Entwertung über sitzungsGeneration', () => {
  it('lässt ein Token mit passendem Stand durch', async () => {
    const { guard, ctx, req } = baue({ sub: 'p1', gen: 3 });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((req['person'] as { id: string }).id).toBe('p1');
  });

  it('hängt den Zählerstand NICHT an die Person am Request', async () => {
    const { guard, ctx, req } = baue({ sub: 'p1', gen: 3 });
    await guard.canActivate(ctx);
    expect(req['person']).not.toHaveProperty('sitzungsGeneration');
    expect(req['person']).not.toHaveProperty('aktiv');
  });

  it('weist ein Token mit veraltetem Stand ab', async () => {
    const { guard, ctx } = baue({ sub: 'p1', gen: 2 });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('weist ein Token ohne Stand ab (vor der Umstellung ausgestellt)', async () => {
    const { guard, ctx } = baue({ sub: 'p1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/beendet/i);
  });

  it('weist einen gefälschten, nicht-numerischen Stand ab', async () => {
    const { guard, ctx } = baue({ sub: 'p1', gen: '3' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('weist ohne Cookie ab', async () => {
    const { guard, ctx, req } = baue({ sub: 'p1', gen: 3 });
    req['cookies'] = {};
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Nicht angemeldet/);
  });

  it('weist ein ungültig signiertes Token ab', async () => {
    const { guard, ctx } = baue(null);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/ungültig|abgelaufen/i);
  });

  it('weist ein deaktiviertes Konto ab', async () => {
    const { guard, ctx, prisma } = baue({ sub: 'p1', gen: 3 });
    prisma.person.findUnique.mockResolvedValue({ ...person, aktiv: false });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/nicht aktiv/i);
  });
});
