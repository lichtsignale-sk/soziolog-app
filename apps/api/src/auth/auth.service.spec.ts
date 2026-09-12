import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { heute, datumPlusTage, zuDatum } from '@soziolog/shared';

jest.mock('argon2');

const argonVerify = argon2.verify as jest.Mock;
const argonHash = argon2.hash as jest.Mock;

function baueService() {
  const prisma = {
    // Die E-Mail-Suche (ohne Groß/Klein) läuft über SQL; ohne Treffer leer.
    $queryRaw: jest.fn().mockResolvedValue([]),
    person: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    passwortReset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signiertes.jwt') };
  const config = {
    get: jest.fn((schluessel: string, fallback?: string) => {
      if (schluessel === 'JWT_SECRET') return 'geheim';
      if (schluessel === 'APP_URL') return 'http://localhost:5173';
      return fallback;
    }),
  };
  const mail = { sendePasswortReset: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    mail as never,
  );
  return { service, prisma, jwt, config, mail };
}

const aktivePerson = {
  id: 'p1',
  name: 'Admin',
  nutzername: 'admin.demo',
  loginEmail: 'admin@demo.test',
  passwortHash: 'argon-hash',
  istAdmin: true,
  benachrichtigungenAktiv: true,
  aktiv: true,
  zweiFaktorAktiv: false,
  fehlversuche: 0,
  gesperrtBis: null,
};

describe('AuthService.login', () => {
  it('gibt bei korrekten Daten die Person zurück', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    argonVerify.mockResolvedValue(true);

    const { person, zweiFaktorAktiv } = await service.login('admin.demo', 'demo1234');
    expect(person.id).toBe('p1');
    expect(person).not.toHaveProperty('passwortHash');
    expect(zweiFaktorAktiv).toBe(false);
  });

  it('wirft generisch bei unbekanntem Nutzer', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(null);

    await expect(service.login('gibtsnicht', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.login('gibtsnicht', 'x')).rejects.toThrow(
      'Anmeldung fehlgeschlagen.',
    );
  });

  it('wirft dieselbe generische Meldung bei falschem Passwort', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    argonVerify.mockResolvedValue(false);

    await expect(service.login('admin.demo', 'falsch')).rejects.toThrow(
      'Anmeldung fehlgeschlagen.',
    );
  });

  it('wirft generisch bei inaktivem Konto (kein Hinweis auf Existenz)', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, aktiv: false });

    await expect(service.login('admin.demo', 'demo1234')).rejects.toThrow(
      'Anmeldung fehlgeschlagen.',
    );
  });
});

describe('AuthService.passwortVergessen', () => {
  it('speichert nur den Hash (nie den Klartext-Token) und verschickt eine Mail', async () => {
    const { service, prisma, mail } = baueService();
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1', loginEmail: 'admin@demo.test' }]);
    prisma.person.findUnique.mockResolvedValue(aktivePerson);
    prisma.passwortReset.create.mockResolvedValue({});

    await service.passwortVergessen('admin@demo.test');

    expect(prisma.passwortReset.create).toHaveBeenCalledTimes(1);
    const daten = prisma.passwortReset.create.mock.calls[0][0].data;
    // tokenHash ist ein SHA-256-Hex (64 Zeichen), NICHT der Klartext-Token.
    expect(daten.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    // Ablauf = Folgetag, rein datumsbasiert.
    expect(daten.laeuftAbAm).toEqual(zuDatum(datumPlusTage(heute(), 1)));

    // Der in die Mail eingebettete Klartext-Token darf nicht dem Hash entsprechen.
    const url = mail.sendePasswortReset.mock.calls[0][1] as string;
    const token = new URL(url).searchParams.get('token');
    expect(token).toBeTruthy();
    expect(token).not.toBe(daten.tokenHash);
  });

  it('tut bei unbekannter E-Mail nichts (neutral)', async () => {
    const { service, prisma, mail } = baueService();
    prisma.person.findUnique.mockResolvedValue(null);

    await service.passwortVergessen('unbekannt@demo.test');

    expect(prisma.passwortReset.create).not.toHaveBeenCalled();
    expect(mail.sendePasswortReset).not.toHaveBeenCalled();
  });
});

describe('AuthService.passwortZuruecksetzen', () => {
  it('setzt das Passwort bei gültigem Token (einmalig) neu', async () => {
    const { service, prisma } = baueService();
    prisma.passwortReset.findFirst.mockResolvedValue({
      id: 'r1',
      personId: 'p1',
      laeuftAbAm: zuDatum(datumPlusTage(heute(), 1)),
      eingeloestAm: null,
    });
    prisma.passwortReset.updateMany.mockResolvedValue({ count: 1 });
    argonHash.mockResolvedValue('neuer-hash');
    prisma.person.update.mockResolvedValue({});

    await service.passwortZuruecksetzen('klartext-token', 'neuesGeheim1');

    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: expect.objectContaining({
        passwortHash: 'neuer-hash',
        passwortGeaendertAm: zuDatum(heute()),
        // Entwertet alle bestehenden Sitzungen (A.6): Wer zuruecksetzt, tut das
        // meist, weil jemand Fremdes Zugriff hatte. Die Aufhebung der
        // Anmeldesperre prueft ein eigener Test weiter unten.
        sitzungsGeneration: { increment: 1 },
      }),
    });
  });

  it('lehnt einen abgelaufenen Token ab', async () => {
    const { service, prisma } = baueService();
    prisma.passwortReset.findFirst.mockResolvedValue({
      id: 'r1',
      personId: 'p1',
      laeuftAbAm: zuDatum('2020-01-01'),
      eingeloestAm: null,
    });

    await expect(
      service.passwortZuruecksetzen('token', 'neuesGeheim1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('lehnt einen bereits verwendeten Token ab (Einmalgebrauch)', async () => {
    const { service, prisma } = baueService();
    prisma.passwortReset.findFirst.mockResolvedValue({
      id: 'r1',
      personId: 'p1',
      laeuftAbAm: zuDatum(datumPlusTage(heute(), 1)),
      eingeloestAm: null,
    });
    prisma.passwortReset.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.passwortZuruecksetzen('token', 'neuesGeheim1'),
    ).rejects.toThrow(/ungültig|verwendet/i);
    expect(prisma.person.update).not.toHaveBeenCalled();
  });

  it('lehnt einen unbekannten Token ab', async () => {
    const { service, prisma } = baueService();
    prisma.passwortReset.findFirst.mockResolvedValue(null);

    await expect(
      service.passwortZuruecksetzen('unbekannt', 'neuesGeheim1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

/**
 * Regressionstests zu A.25: Bei unbekannter Kennung wurde `argon2.verify` gar
 * nicht aufgerufen. Der Laufzeitunterschied verriet, ob ein Konto existiert.
 */
describe('AuthService.login — gleich lange Antwort', () => {
  // Die Zähler von argon2.verify sind dateiweit; ohne Rücksetzen zählt dieser
  // Block die Aufrufe der vorherigen Tests mit.
  beforeEach(() => jest.clearAllMocks());

  it('prüft auch bei unbekannter Kennung gegen einen Vergleichshash', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(null);
    argonHash.mockResolvedValue('vergleichs-hash');
    argonVerify.mockResolvedValue(false);

    await expect(service.login('gibtesnicht', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(argonVerify).toHaveBeenCalledTimes(1);
  });

  it('prüft auch bei deaktiviertem Konto gegen einen Vergleichshash', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, aktiv: false });
    argonHash.mockResolvedValue('vergleichs-hash');
    argonVerify.mockResolvedValue(false);

    await expect(service.login('admin.demo', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(argonVerify).toHaveBeenCalledTimes(1);
  });

  it('meldet unbekannte Kennung und falsches Passwort gleich', async () => {
    const { service, prisma } = baueService();
    argonHash.mockResolvedValue('vergleichs-hash');
    argonVerify.mockResolvedValue(false);

    prisma.person.findFirst.mockResolvedValue(null);
    const unbekannt = await service.login('nix', 'pw').catch((e) => e);
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    const falsch = await service.login('admin.demo', 'pw').catch((e) => e);

    expect(unbekannt.message).toBe(falsch.message);
    expect(unbekannt.getStatus()).toBe(falsch.getStatus());
  });

  it('lässt einen Fehler des Vergleichshashs nicht nach außen dringen', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(null);
    argonHash.mockRejectedValue(new Error('argon kaputt'));

    await expect(service.login('nix', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

/** Regressionstests zu A.6: Das Sitzungs-JWT muss den Generationsstand tragen. */
describe('AuthService.erstelleSitzungsToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signiert den aktuellen Stand von sitzungsGeneration mit', async () => {
    const { service, prisma, jwt } = baueService();
    prisma.person.findUnique.mockResolvedValue({ sitzungsGeneration: 7 });

    await service.erstelleSitzungsToken({ id: 'p1', istAdmin: false });

    expect(jwt.signAsync).toHaveBeenCalledWith(
      { sub: 'p1', istAdmin: false, gen: 7 },
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });

  it('liest den Stand frisch aus der Datenbank, statt ihn zu uebernehmen', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue({ sitzungsGeneration: 0 });

    await service.erstelleSitzungsToken({ id: 'p1', istAdmin: true });

    expect(prisma.person.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      select: { sitzungsGeneration: true },
    });
  });

  it('stellt kein Token aus, wenn die Person verschwunden ist', async () => {
    const { service, prisma } = baueService();
    prisma.person.findUnique.mockResolvedValue(null);

    await expect(
      service.erstelleSitzungsToken({ id: 'weg', istAdmin: false }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

/**
 * Regressionstests zu A.3, zweiter Teil: Es gab nur das IP-Rate-Limit, keinen
 * Zaehler am Konto. Passwortraten gegen ein bekanntes Konto war mit wenigen
 * Adressen praktikabel.
 */
describe('AuthService.login — Anmeldesperre je Konto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zaehlt den Fehlversuch ATOMAR hoch, statt einen gelesenen Wert zu schreiben', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, fehlversuche: 2 });
    prisma.person.update.mockResolvedValue({ fehlversuche: 3 });
    argonVerify.mockResolvedValue(false);

    await expect(service.login('admin.demo', 'falsch')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.person.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { fehlversuche: { increment: 1 } },
      select: { fehlversuche: true },
    });
  });

  it('sperrt anhand des ZURUECKGEGEBENEN Standes, nicht des gelesenen', async () => {
    const { service, prisma } = baueService();
    // Gelesen wurde 0 — parallele Versuche haben in der Zwischenzeit hochgezaehlt.
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, fehlversuche: 0 });
    prisma.person.update.mockResolvedValue({ fehlversuche: 10 });
    argonVerify.mockResolvedValue(false);

    await expect(service.login('admin.demo', 'falsch')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const sperrAufruf = prisma.person.update.mock.calls[1][0];
    expect(sperrAufruf.data.fehlversuche).toBe(0);
    expect(sperrAufruf.data.gesperrtBis).toBeInstanceOf(Date);
  });

  it('sperrt nicht, solange die Schwelle nicht erreicht ist', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    prisma.person.update.mockResolvedValue({ fehlversuche: 9 });
    argonVerify.mockResolvedValue(false);

    await service.login('admin.demo', 'falsch').catch(() => undefined);

    expect(prisma.person.update).toHaveBeenCalledTimes(1);
  });

  /**
   * Der Wettlauf, den der Review aufgedeckt hat: Zehn gleichzeitige Versuche
   * lesen alle denselben Stand. Mit `increment` zaehlt trotzdem jeder einzeln,
   * und der zehnte loest die Sperre aus.
   */
  it('verliert bei gleichzeitigen Versuchen keinen Zaehlschritt', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, fehlversuche: 0 });
    argonVerify.mockResolvedValue(false);

    let zaehler = 0;
    prisma.person.update.mockImplementation((argumente: { data: Record<string, unknown> }) => {
      if ('increment' in (argumente.data.fehlversuche as object ?? {})) {
        zaehler += 1;
        return Promise.resolve({ fehlversuche: zaehler });
      }
      return Promise.resolve({});
    });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.login('admin.demo', 'falsch').catch(() => undefined),
      ),
    );

    expect(zaehler).toBe(10);
    const sperren = prisma.person.update.mock.calls.filter(
      (aufruf: [{ data: Record<string, unknown> }]) =>
        aufruf[0].data.gesperrtBis instanceof Date,
    );
    expect(sperren.length).toBeGreaterThanOrEqual(1);
  });

  it('weist ein gesperrtes Konto ab, ohne das Passwort zu pruefen', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({
      ...aktivePerson,
      gesperrtBis: new Date(Date.now() + 60_000),
    });
    argonHash.mockResolvedValue('vergleichs-hash');
    argonVerify.mockResolvedValue(true); // wuerde durchlassen, wenn geprueft

    await expect(service.login('admin.demo', 'richtig')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(argonVerify).toHaveBeenCalledTimes(1);
    expect(argonVerify).not.toHaveBeenCalledWith('argon-hash', 'richtig');
  });

  it('meldet ein gesperrtes Konto wie ein falsches Passwort', async () => {
    const { service, prisma } = baueService();
    argonHash.mockResolvedValue('vergleichs-hash');
    argonVerify.mockResolvedValue(false);
    prisma.person.update.mockResolvedValue({ fehlversuche: 1 });

    prisma.person.findFirst.mockResolvedValue({
      ...aktivePerson,
      gesperrtBis: new Date(Date.now() + 60_000),
    });
    const gesperrt = await service.login('admin.demo', 'x').catch((e) => e);
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    const falsch = await service.login('admin.demo', 'x').catch((e) => e);

    expect(gesperrt.message).toBe(falsch.message);
  });

  it('laesst nach Ablauf der Sperre wieder zu', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({
      ...aktivePerson,
      gesperrtBis: new Date(Date.now() - 1000),
      fehlversuche: 0,
    });
    prisma.person.findUnique.mockResolvedValue({ sitzungsGeneration: 0 });
    argonVerify.mockResolvedValue(true);

    await expect(service.login('admin.demo', 'richtig')).resolves.toMatchObject({
      person: expect.objectContaining({ id: 'p1' }),
    });
  });

  it('setzt Zaehler und Sperre nach erfolgreicher Anmeldung zurueck', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue({ ...aktivePerson, fehlversuche: 4 });
    argonVerify.mockResolvedValue(true);

    await service.login('admin.demo', 'richtig');

    expect(prisma.person.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { fehlversuche: 0, gesperrtBis: null },
    });
  });

  it('schreibt bei sauberem Konto keine ueberfluessige Zeile', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    argonVerify.mockResolvedValue(true);

    await service.login('admin.demo', 'richtig');

    expect(prisma.person.updateMany).not.toHaveBeenCalled();
  });

  it('laesst ein falsches Passwort auch dann nicht durch, wenn das Zaehlen scheitert', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    argonVerify.mockResolvedValue(false);
    prisma.person.update.mockRejectedValue(new Error('DB weg'));

    await expect(service.login('admin.demo', 'falsch')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  /** Befund B.5 des Reviews. */
  it('hebt die Sperre beim Passwort-Reset auf', async () => {
    const { service, prisma } = baueService();
    prisma.passwortReset.findFirst.mockResolvedValue({
      id: 'r1',
      personId: 'p1',
      laeuftAbAm: zuDatum(datumPlusTage(heute(), 1)),
      eingeloestAm: null,
    });
    prisma.passwortReset.updateMany.mockResolvedValue({ count: 1 });
    argonHash.mockResolvedValue('neuer-hash');
    prisma.person.update.mockResolvedValue({});

    await service.passwortZuruecksetzen('klartext-token', 'neuesGeheim1');

    const daten = prisma.person.update.mock.calls[0][0].data;
    expect(daten.fehlversuche).toBe(0);
    expect(daten.gesperrtBis).toBeNull();
  });
});

describe('E-Mail ohne Rücksicht auf Groß- und Kleinschreibung', () => {
  it('findet beim Passwort-vergessen die Person auch in anderer Schreibweise', async () => {
    const { service, prisma, mail } = baueService();
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1', loginEmail: 'admin@demo.test' }]);
    prisma.person.findUnique.mockResolvedValue(aktivePerson);
    prisma.passwortReset.create.mockResolvedValue({});

    await service.passwortVergessen('  Admin@Demo.TEST ');

    expect(prisma.person.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' } });
    // Die Mail geht an die GESPEICHERTE Adresse, nicht an die eingetippte.
    expect(mail.sendePasswortReset).toHaveBeenCalledWith(
      'admin@demo.test',
      expect.any(String),
    );
  });

  it('übergibt die Eingabe als Parameter und vergleicht mit lower() — kein ILIKE', async () => {
    const { service, prisma } = baueService();

    await service.passwortVergessen(' max_muster@Demo.test ');

    const [teile, ...werte] = prisma.$queryRaw.mock.calls[0];
    expect((teile as string[]).join('?')).toContain('lower("loginEmail") = lower(?)');
    expect((teile as string[]).join('?')).not.toMatch(/ilike/i);
    expect(werte).toEqual(['max_muster@Demo.test']);
  });

  it('wählt bei zwei Schreibweisen derselben Adresse die exakte', async () => {
    const { service, prisma } = baueService();
    prisma.$queryRaw.mockResolvedValue([
      { id: 'p1', loginEmail: 'admin@demo.test' },
      { id: 'p2', loginEmail: 'Admin@demo.test' },
    ]);
    prisma.person.findUnique.mockResolvedValue(null);

    await service.passwortVergessen('Admin@demo.test');

    expect(prisma.person.findUnique).toHaveBeenCalledWith({ where: { id: 'p2' } });
  });

  it('wählt KEINS, wenn mehrere passen und keins exakt — lieber keine Mail als die falsche', async () => {
    const { service, prisma, mail } = baueService();
    prisma.$queryRaw.mockResolvedValue([
      { id: 'p1', loginEmail: 'admin@demo.test' },
      { id: 'p2', loginEmail: 'Admin@demo.test' },
    ]);

    await service.passwortVergessen('ADMIN@DEMO.TEST');

    expect(prisma.person.findUnique).not.toHaveBeenCalled();
    expect(prisma.passwortReset.create).not.toHaveBeenCalled();
    expect(mail.sendePasswortReset).not.toHaveBeenCalled();
  });

  it('meldet bei der Anmeldung auch mit anderer Schreibweise der E-Mail an', async () => {
    const { service, prisma } = baueService();
    prisma.$queryRaw.mockResolvedValue([{ id: 'p1', loginEmail: 'admin@demo.test' }]);
    prisma.person.findFirst.mockResolvedValue(aktivePerson);
    argonVerify.mockResolvedValue(true);

    const ergebnis = await service.login('ADMIN@demo.test', 'richtig');

    expect(prisma.person.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ nutzername: 'ADMIN@demo.test' }, { id: 'p1' }] },
    });
    expect(ergebnis.person.id).toBe('p1');
  });

  it('lässt den Nutzernamen exakt, wenn die Kennung keine bekannte E-Mail ist', async () => {
    const { service, prisma } = baueService();
    prisma.person.findFirst.mockResolvedValue(null);
    argonHash.mockResolvedValue('vergleichshash');
    argonVerify.mockResolvedValue(false);

    await expect(service.login('Admin.Demo', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.person.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ nutzername: 'Admin.Demo' }] },
    });
  });
});
