import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SitzungsPerson } from './sitzung.guard';
import { RechteService } from '../../rechte/rechte.service';

/**
 * Verlangt eine gültige Logbuchführer-Rolle (= Protokollführer) im Domäne, dessen
 * Id als Route-Parameter `domaeneId` übergeben wird. Setzt SitzungGuard davor
 * voraus: `@UseGuards(SitzungGuard, ProtokollfuehrerGuard)`.
 *
 * Admins dürfen ebenfalls schreiben (organisationsweit) – sie sind nicht an die
 * Domäne-Rolle gebunden.
 */
@Injectable()
export class ProtokollfuehrerGuard implements CanActivate {
  constructor(private readonly rechte: RechteService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { person?: SitzungsPerson }>();
    const person = req.person;
    if (!person) {
      throw new UnauthorizedException('Nicht angemeldet.');
    }

    if (person.istAdmin) {
      return true;
    }

    const domaeneId = req.params?.['domaeneId'];
    if (!domaeneId) {
      throw new ForbiddenException('Keine Domäne angegeben.');
    }

    const erlaubt = await this.rechte.istProtokollfuehrer(person.id, domaeneId);
    if (!erlaubt) {
      throw new ForbiddenException(
        'Nur Protokollführer dieser Domäne dürfen hier schreiben.',
      );
    }
    return true;
  }
}
