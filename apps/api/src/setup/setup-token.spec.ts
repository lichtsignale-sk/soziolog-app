import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  SETUP_COOKIE,
  SETUP_TOKEN_MINDESTLAENGE,
  SetupTokenGuard,
  erwartetesGeheimnis,
  gleich,
} from './setup-token.guard';
import { SetupController } from './setup.controller';
import { SetupGesperrtGuard } from './setup-gesperrt.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

const TOKEN = 'f'.repeat(64);

function guardMit(env: Record<string, string>): SetupTokenGuard {
  return new SetupTokenGuard({ get: (k: string, d?: string) => env[k] ?? d } as never);
}

function anfrageMit(
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {},
): ExecutionContext {
  const req = { cookies, headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

/**
 * [K4] Das Erst-Setup war bis zu seinem Abschluss unauthentifiziert. Wer die
 * frische Subdomain zuerst erreichte, wurde Admin der Organisation — und die
 * Instanz kündigt ihre Erreichbarkeit über das Certificate-Transparency-Log
 * sekundengenau öffentlich an.
 */
describe('SetupTokenGuard', () => {
  it('lässt eine Anfrage MIT gültigem Cookie durch', () => {
    expect(
      guardMit({ SETUP_TOKEN: TOKEN }).canActivate(
        anfrageMit({ [SETUP_COOKIE]: TOKEN }),
      ),
    ).toBe(true);
  });

  it('weist eine Anfrage OHNE Cookie ab — der eigentliche Befund', () => {
    expect(() =>
      guardMit({ SETUP_TOKEN: TOKEN }).canActivate(anfrageMit()),
    ).toThrow(ForbiddenException);
  });

  it('weist ein falsches Geheimnis ab', () => {
    expect(() =>
      guardMit({ SETUP_TOKEN: TOKEN }).canActivate(
        anfrageMit({ [SETUP_COOKIE]: 'e'.repeat(64) }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('lässt auch den Kopfzeilen-Weg zu (Werkzeuge ohne Browser)', () => {
    expect(
      guardMit({ SETUP_TOKEN: TOKEN }).canActivate(
        anfrageMit({}, { 'x-setup-token': TOKEN }),
      ),
    ).toBe(true);
  });

  it('bleibt ohne SETUP_TOKEN wirkungslos — bestehende Instanzen unverändert', () => {
    // ABWÄRTSKOMPATIBILITÄT: Eine selbst betriebene Instanz kann kein
    // Geheimnis bekommen; sie muss sich weiterhin einrichten lassen. Bereits
    // eingerichtete Instanzen sperrt ohnehin der SetupGesperrtGuard.
    expect(guardMit({}).canActivate(anfrageMit())).toBe(true);
  });

  it('behandelt ein zu kurzes Geheimnis wie ein fehlendes', () => {
    // Ein `SETUP_TOKEN=1` wäre schlimmer als keiner: Er täuschte Schutz vor.
    expect(guardMit({ SETUP_TOKEN: 'kurz' }).canActivate(anfrageMit())).toBe(true);
  });

  it('wirft bei abweichender Länge keine RangeError', () => {
    expect(() =>
      guardMit({ SETUP_TOKEN: TOKEN }).canActivate(anfrageMit({ [SETUP_COOKIE]: 'x' })),
    ).toThrow(ForbiddenException);
  });
});

describe('erwartetesGeheimnis', () => {
  it('gibt null zurück, solange nichts oder zu wenig gesetzt ist', () => {
    const config = (wert?: string) =>
      ({ get: () => wert }) as never;
    expect(erwartetesGeheimnis(config())).toBeNull();
    expect(erwartetesGeheimnis(config('   '))).toBeNull();
    expect(erwartetesGeheimnis(config('a'.repeat(SETUP_TOKEN_MINDESTLAENGE - 1)))).toBeNull();
    expect(erwartetesGeheimnis(config(TOKEN))).toBe(TOKEN);
  });
});

describe('gleich — zeitkonstant', () => {
  it('vergleicht über gleich lange Abdrücke', () => {
    expect(gleich('abc', 'abc')).toBe(true);
    expect(gleich('abc', 'abd')).toBe(false);
    expect(gleich('kurz', 'viel laenger')).toBe(false);
  });
});

describe('GET /api/setup/start — der Einstieg über den Einladungslink', () => {
  function baue(env: Record<string, string>) {
    const res = {
      cookie: jest.fn(),
      redirect: jest.fn(),
    };
    const controller = new SetupController(
      {} as never,
      { get: (k: string, d?: string) => env[k] ?? d } as never,
    );
    return { controller, res };
  }

  it('setzt das Cookie und leitet auf den Assistenten weiter', () => {
    const { controller, res } = baue({ SETUP_TOKEN: TOKEN, COOKIE_SECURE: '1' });

    controller.start(TOKEN, res as never);

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [name, wert, optionen] = res.cookie.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(SETUP_COOKIE);
    expect(wert).toBe(TOKEN);
    expect(optionen.httpOnly).toBe(true);
    expect(optionen.secure).toBe(true);
    // `lax` ist nötig: Das Cookie muss die Weiterleitung überleben.
    expect(optionen.sameSite).toBe('lax');
    expect(res.redirect).toHaveBeenCalledWith(302, '/setup');
  });

  it('setzt KEIN Cookie bei falschem Geheimnis — leitet aber trotzdem weiter', () => {
    // Kein Orakel: Ob das Geheimnis falsch war oder die Einrichtung schon
    // abgeschlossen ist, sagt diese Route nicht.
    const { controller, res } = baue({ SETUP_TOKEN: TOKEN });

    controller.start('e'.repeat(64), res as never);

    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, '/setup');
  });

  it('setzt kein Cookie ganz ohne Geheimnis in der Adresse', () => {
    const { controller, res } = baue({ SETUP_TOKEN: TOKEN });
    controller.start(undefined, res as never);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, '/setup');
  });

  it('leitet auf einer Instanz ohne SETUP_TOKEN einfach weiter', () => {
    const { controller, res } = baue({});
    controller.start(undefined, res as never);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(302, '/setup');
  });

  it('lässt das Cookie lokal ohne Secure zu (COOKIE_SECURE=0)', () => {
    const { controller, res } = baue({ SETUP_TOKEN: TOKEN, COOKIE_SECURE: '0' });
    controller.start(TOKEN, res as never);
    const optionen = (res.cookie.mock.calls[0] as unknown[])[2] as Record<string, unknown>;
    expect(optionen.secure).toBe(false);
  });
});

describe('Die Schranke hängt wirklich an der Route', () => {
  /**
   * DER GUARD MUSS AN `POST /api/setup` HÄNGEN, sonst nützt er nichts.
   *
   * Geprüft an den Metadaten und nicht an einer Erinnerung: Wer den Decorator
   * beim nächsten Umbau verliert, bekommt einen roten Test statt einer offenen
   * Route — dieselbe Disziplin wie `controller-schutz.spec.ts` in der
   * Verwaltung.
   */
  function guardsVon(methode: string): unknown[] {
    const prototyp = SetupController.prototype as unknown as Record<string, object>;
    return (Reflect.getMetadata(GUARDS_METADATA, prototyp[methode]) as unknown[]) ?? [];
  }

  it('schützt `durchfuehren` mit BEIDEN Schranken', () => {
    const guards = guardsVon('durchfuehren');
    expect(guards).toContain(SetupGesperrtGuard);
    expect(guards).toContain(SetupTokenGuard);
  });

  it('lässt `status` bewusst offen — der Assistent braucht ihn zum Rendern', () => {
    // Er gibt ausschliesslich drei Boolean-Werte zurück, keinen Inhalt.
    expect(guardsVon('status')).toEqual([]);
  });

  it('lässt `start` offen — dort wird das Geheimnis erst geprüft', () => {
    expect(guardsVon('start')).toEqual([]);
  });
});
