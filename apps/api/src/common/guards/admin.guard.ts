import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SitzungsPerson } from './sitzung.guard';

/**
 * Verlangt Admin-Rechte. Setzt voraus, dass SitzungGuard davor lief und
 * req.person gesetzt hat – daher immer als `@UseGuards(SitzungGuard, AdminGuard)`.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { person?: SitzungsPerson }>();
    const person = req.person;
    if (!person) {
      throw new UnauthorizedException('Nicht angemeldet.');
    }
    if (!person.istAdmin) {
      throw new ForbiddenException('Nur für Administratoren.');
    }
    return true;
  }
}
