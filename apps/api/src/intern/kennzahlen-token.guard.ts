import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

/** Mindestlänge des Instanz-Geheimnisses. Kürzeres gilt als „nicht gesetzt". */
export const KENNZAHLEN_TOKEN_MINDESTLAENGE = 32;

/**
 * Schutz des internen Kennzahlen-Endpunkts durch ein PRO INSTANZ erzeugtes
 * Geheimnis aus der Umgebung (`KENNZAHLEN_TOKEN`).
 *
 * ZWEI EIGENSCHAFTEN, und beide sind Absicht:
 *
 * 1. OHNE GEHEIMNIS EXISTIERT DER ENDPUNKT NICHT (404). Genau das Verhalten,
 *    das `AnfrageService` mit `ANFRAGE_EMPFAENGER` schon hat: Eine bestehende
 *    Instanz, die nie eine Variable bekommt, läuft unverändert weiter
 *    und hat auch keinen zusätzlichen offenen Weg. 404 statt 401, damit die
 *    Antwort nicht verrät, dass es hier überhaupt etwas gäbe.
 * 2. DER VERGLEICH IST ZEITKONSTANT. Verglichen werden die SHA-256-Abdrücke,
 *    nicht die Zeichenketten selbst: `timingSafeEqual` verlangt gleiche
 *    Länge, und ein Längenunterschied wäre sonst selbst wieder ein Signal.
 *    Ein Zeichenkettenvergleich bricht beim ersten falschen Zeichen ab und
 *    verrät damit über die Antwortdauer, wie weit ein Rateversuch gekommen ist.
 */
@Injectable()
export class KennzahlenTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const erwartet = this.config.get<string>('KENNZAHLEN_TOKEN')?.trim();
    if (!erwartet || erwartet.length < KENNZAHLEN_TOKEN_MINDESTLAENGE) {
      throw new NotFoundException(
        'Kennzahlen sind auf dieser Instanz nicht aktiv.',
      );
    }

    const anfrage = context.switchToHttp().getRequest<Request>();
    const angeboten = tokenAus(anfrage);
    if (angeboten === null || !gleich(angeboten, erwartet)) {
      throw new UnauthorizedException('Kennzahlen-Zugang verweigert.');
    }
    return true;
  }
}

/**
 * Liest das Geheimnis aus `Authorization: Bearer …`. Sonst `null`.
 *
 * Das Schema wird OHNE Rücksicht auf Gross- und Kleinschreibung erkannt:
 * RFC 7235 verlangt das ausdrücklich, und mancher HTTP-Client schreibt
 * `bearer`. Ein Abruf, der daran scheitert, sähe beim Abfragenden aus wie
 * „Instanz weist uns ab" — ein Fehler, den niemand an dieser Stelle suchen
 * würde.
 *
 * Das GEHEIMNIS selbst bleibt selbstverständlich buchstabengetreu.
 */
function tokenAus(anfrage: Request): string | null {
  const kopf = anfrage.headers.authorization;
  if (typeof kopf !== 'string') return null;
  const treffer = /^bearer[ \t]+(.+)$/i.exec(kopf.trim());
  return treffer ? treffer[1].trim() : null;
}

/** Zeitkonstanter Vergleich über die Abdrücke (immer 32 Byte lang). */
export function gleich(a: string, b: string): boolean {
  return timingSafeEqual(abdruck(a), abdruck(b));
}

function abdruck(wert: string): Buffer {
  return createHash('sha256').update(wert, 'utf8').digest();
}
