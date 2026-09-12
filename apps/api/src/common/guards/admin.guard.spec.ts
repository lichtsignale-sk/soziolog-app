import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { SitzungsPerson } from './sitzung.guard';

function ctx(person?: Partial<SitzungsPerson>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ person }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('401 wenn keine Person am Request', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(UnauthorizedException);
  });

  it('403 für Nicht-Admin', () => {
    expect(() => guard.canActivate(ctx({ istAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it('erlaubt Admins', () => {
    expect(guard.canActivate(ctx({ istAdmin: true }))).toBe(true);
  });
});
