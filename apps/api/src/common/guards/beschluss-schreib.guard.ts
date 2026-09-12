import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SitzungsPerson } from './sitzung.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { RechteService } from '../../rechte/rechte.service';

/**
 * Schreibschutz für Beschluss-bezogene Routen (`:id` = Beschluss). Ermittelt den
 * Domäne über den Vorschlag des Beschlusses und verlangt Protokollführer-Rechte
 * (Admin-Bypass). Setzt SitzungGuard davor voraus.
 */
@Injectable()
export class BeschlussSchreibGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rechte: RechteService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { person?: SitzungsPerson }>();
    const person = req.person;
    if (!person) {
      throw new UnauthorizedException('Nicht angemeldet.');
    }

    const beschluss = await this.prisma.beschluss.findUnique({
      where: { id: req.params?.['id'] },
      select: { vorschlag: { select: { domaeneId: true } } },
    });
    if (!beschluss) {
      throw new NotFoundException('Beschluss nicht gefunden.');
    }

    if (person.istAdmin) {
      return true;
    }
    const erlaubt = await this.rechte.istProtokollfuehrer(
      person.id,
      beschluss.vorschlag.domaeneId,
    );
    if (!erlaubt) {
      throw new ForbiddenException(
        'Nur Protokollführer dieser Domäne dürfen hier schreiben.',
      );
    }
    return true;
  }
}
