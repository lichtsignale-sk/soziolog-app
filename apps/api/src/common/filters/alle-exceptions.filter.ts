import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { maskiereUrl } from '../log-maskierung';

/** Antworttext für alles, was keine bewusst geworfene HttpException ist. */
export const UNERWARTET =
  'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.';

/**
 * Einheitliches Fehlerformat { fehler: { code, nachricht, detail? } } (Regel 3).
 *
 * ZWEI GETRENNTE WEGE, und das ist der Kern dieses Filters:
 *
 * 1. `HttpException` ist eine ABSICHTLICH geworfene, für Menschen gedachte
 *    Meldung ("Das aktuelle Passwort ist falsch."). Sie geht unverändert hinaus.
 *
 * 2. Alles andere ist ein PROGRAMMFEHLER — eine Prisma-Meldung, ein TypeError,
 *    ein Netzwerkabbruch. Deren `message` nennt Modelle, Felder und teils Werte.
 *    Der Filter greift auch vor den Guards, die Meldung ginge also an
 *    Unangemeldete. Nach außen darf davon nichts: fester Text, und das Original
 *    samt Stack nur ins Log.
 *
 * Vorher wurde `exception.message` in beiden Fällen durchgereicht UND nirgends
 * protokolliert — interne Details nach außen, keine Spur nach innen. Genau
 * verkehrt herum.
 */
@Catch()
export class AlleExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Fehler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNER_FEHLER';
    let nachricht = UNERWARTET;
    let detail: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      code = `HTTP_${status}`;
      if (typeof exResponse === 'string') {
        nachricht = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const res = exResponse as Record<string, unknown>;
        if (typeof res['message'] === 'string') {
          nachricht = res['message'];
        } else if (Array.isArray(res['message'])) {
          // DIE VALIDATIONPIPE LIEFERT EIN ARRAY, keinen String — ein Eintrag
          // je verletzter Regel. Wurde das nicht behandelt, blieb `nachricht`
          // auf dem Text für unerwartete Fehler stehen: Der Aufrufer bekam bei
          // einem 400 die Meldung „Ein unerwarteter Fehler ist aufgetreten",
          // obwohl schlicht ein Feld fehlte.
          const meldungen = res['message'].filter(
            (eintrag): eintrag is string => typeof eintrag === 'string',
          );
          if (meldungen.length === 1) {
            nachricht = meldungen[0];
          } else if (meldungen.length > 1) {
            nachricht = 'Die Eingaben sind unvollständig oder ungültig.';
          }
          if (meldungen.length > 0) detail = meldungen;
        }
        if (res['errors'] !== undefined) detail = res['errors'];
      }
    } else {
      // Kein Durchreichen nach außen — aber vollständig ins Log, sonst ist ein
      // 500 im Betrieb nicht nachvollziehbar.
      this.protokolliere(exception, request);
    }

    response.status(status).json({
      fehler: {
        code,
        nachricht,
        ...(detail !== undefined ? { detail } : {}),
      },
    });
  }

  private protokolliere(exception: unknown, request: Request | undefined): void {
    const wo = request
      ? `${request.method ?? '?'} ${maskiereUrl(request.url ?? '')}`
      : 'unbekannte Route';
    const anfrageId = request?.headers?.['x-request-id'];
    const kennung = typeof anfrageId === 'string' ? ` [${anfrageId}]` : '';

    if (exception instanceof Error) {
      this.logger.error(`${wo}${kennung}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`${wo}${kennung}: ${String(exception)}`);
    }
  }
}
