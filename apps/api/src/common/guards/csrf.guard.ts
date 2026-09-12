import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const GESCHUETZTE_METHODEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF-Schutz nach dem Double-Submit-Verfahren.
 *
 * Bei schreibenden Requests (POST/PUT/PATCH/DELETE) muss der Header
 * `x-csrf-token` exakt dem Cookie `csrf` entsprechen. Ein Angreifer von einer
 * fremden Seite kann das Cookie nicht auslesen und daher den Header nicht
 * korrekt setzen. Zusammen mit SameSite=Lax ergibt das doppelten Schutz.
 *
 * Global registriert; GET/HEAD/OPTIONS (inkl. GET /api/auth/csrf) sind ausgenommen.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!GESCHUETZTE_METHODEN.has(req.method)) {
      return true;
    }

    const cookieToken = req.cookies?.['csrf'] as string | undefined;
    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('CSRF-Token fehlt oder ungültig.');
    }
    return true;
  }
}
