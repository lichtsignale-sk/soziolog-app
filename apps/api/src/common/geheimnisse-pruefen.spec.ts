import {
  MINDESTLAENGE,
  pruefeGeheimnisse,
  PFLICHT_GEHEIMNISSE,
} from './geheimnisse-pruefen';

const gut = 'a'.repeat(MINDESTLAENGE);
const produktiv = {
  NODE_ENV: 'production',
  JWT_SECRET: gut,
  SESSION_SECRET: gut,
  CONFIG_KEY: gut,
};

describe('pruefeGeheimnisse', () => {
  it('lässt eine ordentlich eingerichtete Instanz durch', () => {
    expect(() => pruefeGeheimnisse({ ...produktiv })).not.toThrow();
  });

  it('gibt die Umgebung unverändert zurück', () => {
    const umgebung = { ...produktiv, SONSTIGES: 'x' };
    expect(pruefeGeheimnisse(umgebung)).toBe(umgebung);
  });

  /** Der eigentliche Befund: `change-me` lief in Produktion einfach durch. */
  it.each(PFLICHT_GEHEIMNISSE)('lehnt den Platzhalter in %s ab', (name) => {
    expect(() =>
      pruefeGeheimnisse({ ...produktiv, [name]: 'change-me' }),
    ).toThrow(new RegExp(`${name}.*Platzhalter`));
  });

  it('erkennt den Platzhalter unabhängig von Schreibweise und Rand', () => {
    expect(() =>
      pruefeGeheimnisse({ ...produktiv, JWT_SECRET: '  Change-Me ' }),
    ).toThrow(/Platzhalter/);
  });

  it.each(['JWT_SECRET', 'SESSION_SECRET'])('lehnt ein fehlendes %s ab', (name) => {
    const umgebung: Record<string, unknown> = { ...produktiv };
    delete umgebung[name];
    expect(() => pruefeGeheimnisse(umgebung)).toThrow(
      new RegExp(`${name} fehlt`),
    );
  });

  /** [Review B2] Die Anwendung faellt bei CONFIG_KEY auf SESSION_SECRET zurueck. */
  it('laesst ein fehlendes CONFIG_KEY durch, wenn SESSION_SECRET taugt', () => {
    const umgebung: Record<string, unknown> = { ...produktiv };
    delete umgebung['CONFIG_KEY'];
    expect(() => pruefeGeheimnisse(umgebung)).not.toThrow();
  });

  it('warnt bei schlechtem CONFIG_KEY vor einem NEUEN Wert', () => {
    expect(() =>
      pruefeGeheimnisse({ ...produktiv, CONFIG_KEY: 'change-me' }),
    ).toThrow(/GENAU den Wert von SESSION_SECRET/);
  });

  it('lehnt zu kurze Werte ab und nennt die Länge', () => {
    expect(() =>
      pruefeGeheimnisse({ ...produktiv, CONFIG_KEY: 'kurz' }),
    ).toThrow(/CONFIG_KEY ist 4 Zeichen lang/);
  });

  it('nennt ALLE Mängel auf einmal, nicht nur den ersten', () => {
    let meldung = '';
    try {
      pruefeGeheimnisse({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me',
        SESSION_SECRET: 'kurz',
      });
    } catch (e) {
      meldung = (e as Error).message;
    }
    expect(meldung).toMatch(/JWT_SECRET/);
    expect(meldung).toMatch(/SESSION_SECRET/);
    expect(meldung).toMatch(/CONFIG_KEY/);
  });

  it('nennt den Befehl, mit dem man einen Wert erzeugt', () => {
    expect(() => pruefeGeheimnisse({ NODE_ENV: 'production' })).toThrow(
      /openssl rand -hex 32/,
    );
  });

  it('greift in der Entwicklung NICHT — dort soll pnpm dev ohne Vorbereitung laufen', () => {
    expect(() =>
      pruefeGeheimnisse({ NODE_ENV: 'development', JWT_SECRET: 'change-me' }),
    ).not.toThrow();
    expect(() => pruefeGeheimnisse({ JWT_SECRET: 'change-me' })).not.toThrow();
  });
});
