import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { KennzahlenTokenGuard, gleich } from './kennzahlen-token.guard';
import { KennzahlenService, spaetester } from './kennzahlen.service';
import { APP_VERSION } from '../version';
import { createHash } from 'crypto';
import { organisationsnameAbdruck } from '@soziolog/shared';

const TOKEN = 'a'.repeat(48);

function guardMit(env: Record<string, string>): KennzahlenTokenGuard {
  const config = { get: (k: string) => env[k] };
  return new KennzahlenTokenGuard(config as never);
}

function anfrageMit(authorization?: string): ExecutionContext {
  const req = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

/** Prisma-Attrappe, die ausschließlich Zählwerte und Maxima beantwortet. */
function prismaDoppel(werte: {
  personen: number;
  kreise: number;
  vorschlag: Date | null;
  bedenken: Date | null;
  einwand: Date | null;
  beschluss: Date | null;
  anmeldung: Date | null;
}) {
  return {
    person: {
      count: jest.fn().mockResolvedValue(werte.personen),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _max: { letzteAnmeldungAm: werte.anmeldung } }),
    },
    domaene: { count: jest.fn().mockResolvedValue(werte.kreise) },
    organisation: {
      findFirst: jest.fn().mockResolvedValue({ name: 'Musterverein Ostend e. V.' }),
    },
    vorschlag: {
      aggregate: jest.fn().mockResolvedValue({ _max: { datum: werte.vorschlag } }),
    },
    bedenken: {
      aggregate: jest.fn().mockResolvedValue({ _max: { datum: werte.bedenken } }),
    },
    einwand: {
      aggregate: jest.fn().mockResolvedValue({ _max: { datum: werte.einwand } }),
    },
    beschluss: {
      aggregate: jest.fn().mockResolvedValue({ _max: { datum: werte.beschluss } }),
    },
  };
}

const VOLL = {
  personen: 34,
  kreise: 6,
  vorschlag: new Date('2026-08-01T00:00:00.000Z'),
  bedenken: new Date('2026-08-19T00:00:00.000Z'),
  einwand: null,
  beschluss: new Date('2026-08-11T00:00:00.000Z'),
  anmeldung: new Date('2026-08-28T00:00:00.000Z'),
};

// ---------------------------------------------------------------------------
// DIE ERLAUBNISLISTE. Der eigentliche Gegenstand dieser Datei.
// ---------------------------------------------------------------------------

/**
 * WAS DIE ANTWORT ENTHALTEN DARF — abschliessend, Feld für Feld.
 *
 * Der Zugang zu einer Instanz ist mit einem Satz beschrieben: sechs Zahlen, keine Inhalte. Ein späterer Umbau darf diesen
 * Satz nicht stillschweigend falsch machen. Deshalb prüft dieser Test nicht
 * „die erwarteten Felder sind da", sondern die schärfere Aussage: ES GIBT
 * KEINE ANDEREN, und jeder Wert erfüllt eine ENGE Form. Ein durchgereichter
 * Name, ein Titel, ein Freitext oder ein verschachteltes Objekt fällt damit
 * auf, ohne dass jemand daran denken muss.
 */
const ERLAUBT: Record<string, { art: string; pruefe: (w: unknown) => boolean }> =
  {
    aktivePersonen: {
      art: 'Zählwert oder null',
      pruefe: (w) => w === null || (typeof w === 'number' && Number.isInteger(w) && w >= 0),
    },
    kreise: {
      art: 'Zählwert oder null',
      pruefe: (w) => w === null || (typeof w === 'number' && Number.isInteger(w) && w >= 0),
    },
    letzterEintragAm: {
      art: 'Tagesdatum oder null',
      pruefe: (w) => w === null || (typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w)),
    },
    letzteAnmeldungAm: {
      art: 'Tagesdatum oder null',
      pruefe: (w) => w === null || (typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w)),
    },
    appVersion: {
      art: 'Versionsnummer',
      pruefe: (w) => typeof w === 'string' && /^\d+\.\d+\.\d+$/.test(w),
    },
    datenbank: {
      art: 'Zustand (erreichbar|gestoert)',
      pruefe: (w) => w === 'erreichbar' || w === 'gestoert',
    },
    /**
     * EIN BOOLEAN IST KEIN INHALT — die bewusste Erweiterung der Liste.
     *
     * Gewünscht ist ein Abgleich des Organisationsnamens, verboten ist jeder
     * Name in dieser Antwort. Der Ausweg ist ein Vergleich über ABDRÜCKE: Der
     * Abfragende schickt den Abdruck des erwarteten Namens, die Instanz
     * antwortet mit ja, nein oder „nicht gemessen". Über die Leitung geht in
     * KEINER Richtung ein Name. Der Satz oben bleibt wahr.
     */
    organisationsnameStimmt: {
      art: 'Wahrheitswert oder null',
      pruefe: (w) => w === null || typeof w === 'boolean',
    },
  };

function verstoesse(antwort: Record<string, unknown>): string[] {
  const gefunden: string[] = [];
  for (const [feld, wert] of Object.entries(antwort)) {
    const regel = ERLAUBT[feld];
    if (regel === undefined) {
      gefunden.push(`${feld}: steht nicht auf der Erlaubnisliste`);
      continue;
    }
    if (!regel.pruefe(wert)) {
      gefunden.push(`${feld}: ist kein ${regel.art} (${JSON.stringify(wert)})`);
    }
  }
  return gefunden;
}

describe('Kennzahlen — Erlaubnisliste (keine Inhalte)', () => {
  it('liefert ausschließlich Zählwerte, Tagesdaten, Version und Zustand', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe();

    expect(verstoesse(antwort as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('hat genau die vereinbarten Felder — kein weiteres', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe();

    expect(Object.keys(antwort).sort()).toEqual(Object.keys(ERLAUBT).sort());
  });

  it('enthält nirgends ein verschachteltes Objekt oder eine Liste', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe();

    for (const wert of Object.values(antwort)) {
      expect(Array.isArray(wert)).toBe(false);
      expect(typeof wert === 'object' && wert !== null).toBe(false);
    }
  });

  it('fällt um, sobald ein Inhaltsfeld durchgereicht würde', () => {
    // Die Gegenprobe: der Test prüft wirklich etwas. Ohne sie wäre nicht
    // belegt, dass die Erlaubnisliste je einen Verstoß gefunden hätte.
    expect(
      verstoesse({
        aktivePersonen: 34,
        organisationName: 'Musterverein Ostend e. V.',
      }),
    ).toEqual(['organisationName: steht nicht auf der Erlaubnisliste']);
    expect(verstoesse({ letzterEintragAm: 'Beschluss zur Beitragsordnung' })).toEqual([
      'letzterEintragAm: ist kein Tagesdatum oder null (' +
        '"Beschluss zur Beitragsordnung")',
    ]);
  });
});

describe('Kennzahlen — Werte', () => {
  it('nennt den jüngsten Tag über alle vier Eintragsarten', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe();

    expect(antwort.aktivePersonen).toBe(34);
    expect(antwort.kreise).toBe(6);
    expect(antwort.letzterEintragAm).toBe('2026-08-19');
    expect(antwort.letzteAnmeldungAm).toBe('2026-08-28');
    expect(antwort.appVersion).toBe(APP_VERSION);
    expect(antwort.datenbank).toBe('erreichbar');
  });

  it('meldet den Namensabgleich als „nicht gemessen", solange keiner verlangt ist', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    expect((await service.erhebe()).organisationsnameStimmt).toBeNull();
  });

  it('nennt eine frische Instanz ohne Einträge ehrlich mit null', async () => {
    const service = new KennzahlenService(
      prismaDoppel({
        personen: 1,
        kreise: 1,
        vorschlag: null,
        bedenken: null,
        einwand: null,
        beschluss: null,
        anmeldung: null,
      }) as never,
    );
    const antwort = await service.erhebe();

    expect(antwort.letzterEintragAm).toBeNull();
    expect(antwort.letzteAnmeldungAm).toBeNull();
  });

  it('meldet eine gestörte Datenbank als Zustand statt als Serverfehler', async () => {
    const kaputt = prismaDoppel(VOLL);
    kaputt.person.count = jest
      .fn()
      .mockRejectedValue(new Error('Connection refused'));
    const service = new KennzahlenService(kaputt as never);

    const antwort = await service.erhebe();

    // Fehlerfall: Zählwerte sind null, NICHT 0 — eine 0 läse der Abfragende
    // als Abwanderung und löste die Aufgabe „seit 45 Tagen kein Eintrag" aus.
    expect(antwort.datenbank).toBe('gestoert');
    expect(antwort.aktivePersonen).toBeNull();
    expect(antwort.kreise).toBeNull();
    expect(verstoesse(antwort as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('gibt den Grund der Störung NICHT in der Antwort preis', async () => {
    const kaputt = prismaDoppel(VOLL);
    kaputt.person.count = jest
      .fn()
      .mockRejectedValue(new Error('postgresql://soziolog:geheim@db:5432'));
    const service = new KennzahlenService(kaputt as never);

    const antwort = await service.erhebe();

    expect(JSON.stringify(antwort)).not.toContain('geheim');
    expect(JSON.stringify(antwort)).not.toContain('postgresql');
  });
});

describe('spaetester', () => {
  it('nimmt den spätesten Tag und übergeht null', () => {
    expect(
      spaetester([
        new Date('2026-01-05T00:00:00.000Z'),
        null,
        new Date('2026-03-09T00:00:00.000Z'),
      ]),
    ).toBe('2026-03-09');
  });

  it('gibt null zurück, wenn es gar keinen Tag gibt', () => {
    expect(spaetester([null, null])).toBeNull();
  });
});

describe('KennzahlenTokenGuard', () => {
  it('existiert ohne KENNZAHLEN_TOKEN nicht (404, wie ANFRAGE_EMPFAENGER)', () => {
    expect(() => guardMit({}).canActivate(anfrageMit(`Bearer ${TOKEN}`))).toThrow(
      NotFoundException,
    );
  });

  it('behandelt ein zu kurzes Geheimnis wie ein fehlendes', () => {
    expect(() =>
      guardMit({ KENNZAHLEN_TOKEN: 'kurz' }).canActivate(anfrageMit('Bearer kurz')),
    ).toThrow(NotFoundException);
  });

  it('lässt das richtige Geheimnis durch', () => {
    expect(
      guardMit({ KENNZAHLEN_TOKEN: TOKEN }).canActivate(anfrageMit(`Bearer ${TOKEN}`)),
    ).toBe(true);
  });

  it('weist ein falsches Geheimnis ab', () => {
    expect(() =>
      guardMit({ KENNZAHLEN_TOKEN: TOKEN }).canActivate(
        anfrageMit(`Bearer ${'b'.repeat(48)}`),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('weist eine Anfrage ganz ohne Kopfzeile ab', () => {
    expect(() =>
      guardMit({ KENNZAHLEN_TOKEN: TOKEN }).canActivate(anfrageMit()),
    ).toThrow(UnauthorizedException);
  });

  it('weist ein Geheimnis mit falscher Länge ab, ohne zu werfen', () => {
    // Zeitkonstanter Vergleich über SHA-256: `timingSafeEqual` verlangt gleiche
    // Pufferlänge. Ohne den Abdruck flöge hier eine RangeError-Ausnahme, und
    // die Länge des richtigen Geheimnisses wäre über die Antwort ablesbar.
    expect(() =>
      guardMit({ KENNZAHLEN_TOKEN: TOKEN }).canActivate(anfrageMit('Bearer x')),
    ).toThrow(UnauthorizedException);
  });

  it('erkennt das Schema unabhängig von der Schreibweise (RFC 7235)', () => {
    const guard = guardMit({ KENNZAHLEN_TOKEN: TOKEN });
    expect(guard.canActivate(anfrageMit(`bearer ${TOKEN}`))).toBe(true);
    expect(guard.canActivate(anfrageMit(`BEARER ${TOKEN}`))).toBe(true);
    expect(guard.canActivate(anfrageMit(`BeArEr  ${TOKEN}`))).toBe(true);
  });

  it('hält das Geheimnis selbst buchstabengetreu', () => {
    expect(() =>
      guardMit({ KENNZAHLEN_TOKEN: TOKEN }).canActivate(
        anfrageMit(`Bearer ${TOKEN.toUpperCase()}`),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('vergleicht zeitkonstant über gleich lange Abdrücke', () => {
    expect(gleich('abc', 'abc')).toBe(true);
    expect(gleich('abc', 'abd')).toBe(false);
    expect(gleich('kurz', 'sehr viel laenger')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Namensabgleich ohne Namen: der Abgleich über Abdrücke.
// ---------------------------------------------------------------------------

const abdruckVon = (name: string): string =>
  organisationsnameAbdruck(name, (wert) =>
    createHash('sha256').update(wert, 'utf8').digest('hex'),
  );

describe('Namensabgleich über Abdrücke (Abgleich ohne Namen in der Antwort)', () => {
  it('meldet `true`, wenn der Name der Instanz dem erwarteten entspricht', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe(abdruckVon('Musterverein Ostend e. V.'));
    expect(antwort.organisationsnameStimmt).toBe(true);
  });

  it('verträgt eine andere Schreibweise desselben Namens', () => {
    // Sonst meldete der Abgleich für jede Instanz eine Abweichung, und die
    // Meldung würde zur Gewohnheit.
    expect(abdruckVon('Musterverein Ostend e.V.')).toBe(
      abdruckVon('Musterverein Ostend e. V.'),
    );
  });

  it('meldet `false` nach einer echten Umfirmierung — der Fall, für den der Abgleich da ist', async () => {
    // DAS IST DER FALL, DEN DIE FRÜHERE FASSUNG NICHT FAND: Der Verein
    // firmiert IN SEINER INSTANZ um, der Abfragende führt den alten Namen.
    // Ein Vergleich von Subdomain gegen den dort geführten Namen sieht davon
    // nichts.
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe(abdruckVon('Wohnprojekt Grünzug'));
    expect(antwort.organisationsnameStimmt).toBe(false);
  });

  it('meldet `null`, wenn es noch gar keine Organisation gibt', async () => {
    const ohne = prismaDoppel(VOLL);
    ohne.organisation.findFirst = jest.fn().mockResolvedValue(null);
    const service = new KennzahlenService(ohne as never);
    // „nicht gemessen" ist etwas anderes als „weicht ab" — der Abfragende
    // darf daraus keine Abweichung machen.
    expect((await service.erhebe(abdruckVon('egal'))).organisationsnameStimmt).toBeNull();
  });

  it('gibt den Namen der Instanz auch dabei NICHT preis', async () => {
    const service = new KennzahlenService(prismaDoppel(VOLL) as never);
    const antwort = await service.erhebe(abdruckVon('Wohnprojekt Grünzug'));
    const alsText = JSON.stringify(antwort);
    expect(alsText).not.toContain('Musterverein');
    expect(alsText).not.toContain('Ostend');
    expect(verstoesse(antwort as unknown as Record<string, unknown>)).toEqual([]);
  });
});

describe('Der Abfrageparameter ist kein Weg für Fremdtext', () => {
  it('nimmt ausschliesslich einen 64-stelligen Hex-Abdruck an', () => {
    const muster = /^[0-9a-f]{64}$/;
    expect(muster.test(abdruckVon('Musterverein'))).toBe(true);
    expect(muster.test('<script>alert(1)</script>')).toBe(false);
    expect(muster.test('Musterverein Ostend e. V.')).toBe(false);
    expect(muster.test('ABCDEF'.repeat(11))).toBe(false);
    expect(muster.test('')).toBe(false);
  });
});
