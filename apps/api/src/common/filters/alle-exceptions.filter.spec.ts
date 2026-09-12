import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { PasswortAendernDto } from '../../konto/dto/passwort-aendern.dto';
import { AlleExceptionsFilter, UNERWARTET } from './alle-exceptions.filter';

interface Antwort {
  status: number;
  koerper: unknown;
}

function baueHost(url = '/api/vorschlaege'): {
  host: ArgumentsHost;
  antwort: Antwort;
} {
  const antwort: Antwort = { status: 0, koerper: undefined };
  const res = {
    status(code: number) {
      antwort.status = code;
      return this;
    },
    json(koerper: unknown) {
      antwort.koerper = koerper;
      return this;
    },
  };
  const req = { method: 'POST', url, headers: { 'x-request-id': 'abc-1' } };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, antwort };
}

describe('AlleExceptionsFilter', () => {
  let filter: AlleExceptionsFilter;
  let fehlerLog: jest.SpyInstance;

  beforeEach(() => {
    filter = new AlleExceptionsFilter();
    fehlerLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('reicht die Meldung einer bewusst geworfenen HttpException durch', () => {
    const { host, antwort } = baueHost();
    filter.catch(new ForbiddenException('Nur Admins dürfen das.'), host);

    expect(antwort.status).toBe(403);
    expect(antwort.koerper).toEqual({
      fehler: { code: 'HTTP_403', nachricht: 'Nur Admins dürfen das.' },
    });
    expect(fehlerLog).not.toHaveBeenCalled();
  });

  it('übernimmt ein gesetztes errors-Feld als detail', () => {
    const { host, antwort } = baueHost();
    filter.catch(
      new BadRequestException({ message: 'Ungültig.', errors: ['titel fehlt'] }),
      host,
    );

    expect(antwort.koerper).toEqual({
      fehler: {
        code: 'HTTP_400',
        nachricht: 'Ungültig.',
        detail: ['titel fehlt'],
      },
    });
  });

  /**
   * NICHT gegen eine ausgedachte Form, sondern gegen das, was die echte
   * ValidationPipe wirklich wirft. Der vorherige Test prüfte ein `errors`-Feld,
   * das die Pipe nie erzeugt — er wäre auch vor dem Fix grün gewesen.
   */
  it('macht aus einer echten ValidationPipe-Meldung keinen "unerwarteten Fehler"', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
    let geworfen: unknown;
    try {
      await pipe.transform(
        { altesPasswort: 'x', neuesPasswort: 'y' },
        { type: 'body', metatype: PasswortAendernDto },
      );
    } catch (ausnahme) {
      geworfen = ausnahme;
    }
    expect(geworfen).toBeInstanceOf(BadRequestException);

    const { host, antwort } = baueHost();
    filter.catch(geworfen, host);

    const koerper = antwort.koerper as { fehler: { nachricht: string; detail?: unknown } };
    expect(antwort.status).toBe(400);
    expect(koerper.fehler.nachricht).not.toBe(UNERWARTET);
    expect(Array.isArray(koerper.fehler.detail)).toBe(true);
    expect(JSON.stringify(koerper.fehler.detail)).toMatch(/passwort/i);
  });

  it('reicht eine einzelne Regelverletzung wörtlich durch', () => {
    const { host, antwort } = baueHost();
    filter.catch(new BadRequestException({ message: ['name darf nicht leer sein'] }), host);

    const koerper = antwort.koerper as { fehler: { nachricht: string } };
    expect(koerper.fehler.nachricht).toBe('name darf nicht leer sein');
  });

  it('fasst mehrere Regelverletzungen zusammen und legt sie in detail', () => {
    const { host, antwort } = baueHost();
    filter.catch(
      new BadRequestException({ message: ['a fehlt', 'b ist zu kurz'] }),
      host,
    );

    const koerper = antwort.koerper as { fehler: { nachricht: string; detail: unknown } };
    expect(koerper.fehler.nachricht).toMatch(/unvollständig oder ungültig/i);
    expect(koerper.fehler.detail).toEqual(['a fehlt', 'b ist zu kurz']);
  });

  it('gibt bei einem Prisma-Fehler NICHTS Internes preis', () => {
    const { host, antwort } = baueHost();
    const prismaFehler = new Error(
      'Invalid `prisma.person.create()` invocation: Unique constraint failed on the fields: (`loginEmail`)',
    );

    filter.catch(prismaFehler, host);

    expect(antwort.status).toBe(500);
    expect(antwort.koerper).toEqual({
      fehler: { code: 'INTERNER_FEHLER', nachricht: UNERWARTET },
    });
    const alsText = JSON.stringify(antwort.koerper);
    expect(alsText).not.toMatch(/prisma/i);
    expect(alsText).not.toMatch(/loginEmail/);
  });

  it('protokolliert den unerwarteten Fehler samt Route und Anfrage-Kennung', () => {
    const { host } = baueHost();
    filter.catch(new Error('kaputt'), host);

    expect(fehlerLog).toHaveBeenCalledTimes(1);
    const [meldung] = fehlerLog.mock.calls[0] as [string, string?];
    expect(meldung).toContain('POST /api/vorschlaege');
    expect(meldung).toContain('abc-1');
    expect(meldung).toContain('kaputt');
  });

  it('maskiert den Token in der protokollierten Route', () => {
    const { host } = baueHost('/api/setup/start?token=streng-geheim');
    filter.catch(new Error('kaputt'), host);

    const [meldung] = fehlerLog.mock.calls[0] as [string, string?];
    expect(meldung).not.toContain('streng-geheim');
    expect(meldung).toContain('<maskiert>');
  });

  it('kommt mit einem geworfenen Nicht-Fehler zurecht', () => {
    const { host, antwort } = baueHost();
    filter.catch('einfach nur ein String', host);

    expect(antwort.status).toBe(500);
    expect(antwort.koerper).toEqual({
      fehler: { code: 'INTERNER_FEHLER', nachricht: UNERWARTET },
    });
    expect(fehlerLog).toHaveBeenCalledTimes(1);
  });
});
