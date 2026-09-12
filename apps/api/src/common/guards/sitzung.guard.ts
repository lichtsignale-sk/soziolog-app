import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/** Die an den Request gehängte, angemeldete Person (ohne passwortHash). */
export interface SitzungsPerson {
  id: string;
  organisationId: string;
  name: string;
  nutzername: string;
  loginEmail: string;
  istAdmin: boolean;
  benachrichtigungenAktiv: boolean;
}

/**
 * Schützt Routen: verlangt ein gültiges, signiertes Session-JWT im
 * httpOnly-Cookie `sitzung`. Lädt die Person, prüft `aktiv`, und hängt sie als
 * req.person an. Wirft sonst 401.
 */
@Injectable()
export class SitzungGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.['sitzung'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Nicht angemeldet.');
    }

    let sub: string;
    let gen: number;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; gen?: number }>(
        token,
        { secret: this.config.get<string>('JWT_SECRET') },
      );
      sub = payload.sub;
      // -1 für Token ohne Stand: Das sind Ausweise von vor der Einführung des
      // Zählers. Sie gelten nicht mehr, denn ihr Alter ist nicht prüfbar. Beim
      // Ausrollen führt das einmalig dazu, dass alle sich neu anmelden.
      gen = typeof payload.gen === 'number' ? payload.gen : -1;
    } catch {
      throw new UnauthorizedException('Sitzung ungültig oder abgelaufen.');
    }

    const person = await this.prisma.person.findUnique({
      where: { id: sub },
      select: {
        id: true,
        organisationId: true,
        name: true,
        nutzername: true,
        loginEmail: true,
        istAdmin: true,
        benachrichtigungenAktiv: true,
        aktiv: true,
        sitzungsGeneration: true,
      },
    });

    if (!person || !person.aktiv) {
      throw new UnauthorizedException('Konto nicht aktiv.');
    }

    // Der Kern der Entwertung: Passwortwechsel und Passwort-Reset zählen
    // `sitzungsGeneration` hoch. Jedes vorher ausgestellte Token trägt dann
    // einen zu kleinen Stand und ist ab sofort wertlos — auch wenn seine
    // Signatur gültig und seine Laufzeit von sieben Tagen noch nicht um ist.
    if (person.sitzungsGeneration !== gen) {
      throw new UnauthorizedException(
        'Die Sitzung wurde beendet. Bitte melde dich erneut an.',
      );
    }

    const {
      aktiv: _aktiv,
      sitzungsGeneration: _gen,
      ...ohneAktiv
    } = person;
    (req as Request & { person?: SitzungsPerson }).person = ohneAktiv;
    return true;
  }
}
