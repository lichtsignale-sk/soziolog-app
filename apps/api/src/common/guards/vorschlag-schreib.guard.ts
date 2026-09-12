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
 * Schreibschutz für Vorschlag-bezogene Routen (Bedenken/Einwände/Beschluss),
 * deren Pfad nur die Vorschlag-Id (`:id`) enthält. Ermittelt den Domäne des
 * Vorschlags und verlangt Protokollführer-Rechte (Admins dürfen ebenfalls).
 * Setzt SitzungGuard davor voraus.
 */
@Injectable()
export class VorschlagSchreibGuard implements CanActivate {
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

    const vorschlagId = req.params?.['id'];
    const vorschlag = await this.prisma.vorschlag.findUnique({
      where: { id: vorschlagId },
      select: { domaeneId: true },
    });
    if (!vorschlag) {
      throw new NotFoundException('Vorschlag nicht gefunden.');
    }

    if (person.istAdmin) {
      return true;
    }
    const erlaubt = await this.rechte.istProtokollfuehrer(
      person.id,
      vorschlag.domaeneId,
    );
    if (!erlaubt) {
      throw new ForbiddenException(
        'Nur Protokollführer dieser Domäne dürfen hier schreiben.',
      );
    }
    return true;
  }
}
