import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/** Mindestlänge des Einrichtungsgeheimnisses. Kürzeres gilt als „nicht gesetzt". */
export const SETUP_TOKEN_MINDESTLAENGE = 32;

/** Name des kurzlebigen Cookies, das der Einrichtungslink setzt. */
export const SETUP_COOKIE = 'einrichtung';

/**
 * SCHÜTZT DAS ERST-SETUP, SOLANGE ES NOCH NICHT DURCHGEFÜHRT IST.
 *
 * DAS PROBLEM, DAS ES GAB: `POST /api/setup` war bis zum Abschluss der
 * Einrichtung unauthentifiziert — wer die frische Subdomain zuerst erreicht,
 * wird Admin der Organisation. Solange Instanzen von Hand entstehen, ist das
 * ein enges Zeitfenster, das niemand kennt. Werden Instanzen automatisiert
 * aufgebaut, wird daraus ein Regelbetrieb: Der Aufbau wartet
 * typischerweise auf ein gültiges TLS-Zertifikat, und jedes ausgestellte
 * Zertifikat steht sekundengenau im Certificate-Transparency-Log. Die neue,
 * noch unbeanspruchte Instanz wird also im Moment ihrer Erreichbarkeit
 * öffentlich angekündigt.
 *
 * WIE ES GESCHÜTZT WIRD: Wer die Instanz anlegt, setzt eine Umgebungsvariable
 * `SETUP_TOKEN` — derselbe Weg wie `KENNZAHLEN_TOKEN`, also KEINE
 * Schreiboperation von außen in die Datenbank der Instanz. Der
 * Einladungslink trägt das Geheimnis; `GET /api/setup/start` prüft es
 * zeitkonstant, setzt ein kurzlebiges httpOnly-Cookie und leitet auf den
 * Assistenten weiter. `POST /api/setup` verlangt danach das Cookie.
 *
 * WARUM ÜBER EIN COOKIE UND NICHT ÜBER DAS FORMULAR: So bleibt der
 * Einrichtungsassistent selbst unverändert. Der Browser hängt das Cookie an
 * jede Anfrage derselben Herkunft; das Geheimnis steht nicht im Formular, nicht
 * im Verlauf des Assistenten und nicht in einem JavaScript-Zustand.
 *
 * ABWÄRTSKOMPATIBEL: Ohne gesetzte `SETUP_TOKEN`-Variable verhält sich alles
 * wie bisher. Eine selbst betriebene Instanz (on-premise), bei der niemand ein
 * Geheimnis vergeben kann, lässt sich weiterhin ohne Umweg einrichten — und
 * bereits eingerichtete Instanzen sind ohnehin durch `SetupGesperrtGuard`
 * gesperrt. Automatisiert angelegte Instanzen sollten die Variable IMMER
 * bekommen.
 */
@Injectable()
export class SetupTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const erwartet = erwartetesGeheimnis(this.config);
    if (erwartet === null) return true;

    const anfrage = context.switchToHttp().getRequest<Request>();
    const cookies = (anfrage.cookies ?? {}) as Record<string, string>;
    const angeboten =
      cookies[SETUP_COOKIE] ??
      kopfWert(anfrage.headers['x-setup-token']) ??
      null;

    if (angeboten === null || !gleich(angeboten, erwartet)) {
      throw new ForbiddenException(
        'Die Einrichtung dieser Instanz ist nur über den Einladungslink ' +
          'möglich. Öffne den Link erneut, den du beim Anlegen erhalten hast.',
      );
    }
    return true;
  }
}

/**
 * Das erwartete Geheimnis — oder `null`, wenn der Schutz nicht eingerichtet
 * ist. Zu kurze Werte gelten als nicht gesetzt: ein `SETUP_TOKEN=1` wäre
 * schlimmer als keiner, weil er Schutz vortäuschte.
 */
export function erwartetesGeheimnis(config: ConfigService): string | null {
  const wert = config.get<string>('SETUP_TOKEN')?.trim();
  if (!wert || wert.length < SETUP_TOKEN_MINDESTLAENGE) return null;
  return wert;
}

function kopfWert(wert: string | string[] | undefined): string | null {
  return typeof wert === 'string' ? wert : null;
}

/**
 * Zeitkonstanter Vergleich über SHA-256-Abdrücke.
 *
 * Verglichen werden die Abdrücke und nicht die Zeichenketten: `timingSafeEqual`
 * verlangt gleiche Pufferlänge, und ein Längenunterschied wäre sonst selbst
 * wieder ein Signal.
 */
export function gleich(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a, 'utf8').digest(),
    createHash('sha256').update(b, 'utf8').digest(),
  );
}
