import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { KorrekturZielTyp } from '@soziolog/shared';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';
import { RechteService } from '../rechte/rechte.service';
import { KorrekturService } from './korrektur.service';

/**
 * Erlaubt das Stellen eines Korrekturantrags nur, wenn die Person
 * Protokollführer des Domäne ist, zu dem der Zieleintrag gehört (Admin-Bypass
 * konsistent zu den übrigen Schreib-Guards). Der Domäne wird aus zielTyp/zielId
 * im Request-Body aufgelöst (nicht aus einem Query-/Pfadparameter).
 */
@Injectable()
export class KorrekturAntragGuard implements CanActivate {
  constructor(
    private readonly korrektur: KorrekturService,
    private readonly rechte: RechteService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { person?: SitzungsPerson }>();
    const person = req.person;
    if (!person) throw new UnauthorizedException('Nicht angemeldet.');

    const body = (req.body ?? {}) as {
      zielTyp?: KorrekturZielTyp;
      zielId?: string;
    };
    if (!body.zielTyp || !body.zielId) {
      throw new ForbiddenException('zielTyp und zielId sind erforderlich.');
    }

    // Löst den Domäne auf (wirft 404, wenn das Ziel fehlt).
    const ziel = await this.korrektur.zielKontext(body.zielTyp, body.zielId);

    if (person.istAdmin) return true;
    const erlaubt = await this.rechte.istProtokollfuehrer(person.id, ziel.domaeneId);
    if (!erlaubt) {
      throw new ForbiddenException(
        'Nur Protokollführer dieser Domäne dürfen eine Korrektur beantragen.',
      );
    }
    return true;
  }
}
