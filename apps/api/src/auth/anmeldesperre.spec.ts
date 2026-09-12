import {
  istGesperrt,
  sperreErreicht,
  sperrEnde,
  SPERRE_AB_VERSUCHEN,
  SPERRDAUER_MS,
} from './anmeldesperre';

const jetzt = new Date('2026-09-02T10:00:00.000Z');

describe('istGesperrt', () => {
  it('ohne Sperrzeitpunkt nicht gesperrt', () => {
    expect(istGesperrt(null, jetzt)).toBe(false);
    expect(istGesperrt(undefined, jetzt)).toBe(false);
  });

  it('gesperrt, solange der Zeitpunkt in der Zukunft liegt', () => {
    expect(istGesperrt(new Date(jetzt.getTime() + 1000), jetzt)).toBe(true);
  });

  it('nach Ablauf nicht mehr gesperrt', () => {
    expect(istGesperrt(new Date(jetzt.getTime() - 1), jetzt)).toBe(false);
    expect(istGesperrt(jetzt, jetzt)).toBe(false);
  });
});

describe('sperreErreicht', () => {
  it('unterhalb der Schwelle nicht', () => {
    expect(sperreErreicht(0)).toBe(false);
    expect(sperreErreicht(SPERRE_AB_VERSUCHEN - 1)).toBe(false);
  });

  it('genau auf der Schwelle und darueber', () => {
    expect(sperreErreicht(SPERRE_AB_VERSUCHEN)).toBe(true);
    // Kann bei gleichzeitigen Versuchen vorkommen: Zwei Anfragen zaehlen
    // beide hoch, bevor eine die Sperre setzt.
    expect(sperreErreicht(SPERRE_AB_VERSUCHEN + 5)).toBe(true);
  });
});

describe('sperrEnde', () => {
  it('liegt eine Viertelstunde in der Zukunft', () => {
    expect(sperrEnde(jetzt)).toEqual(new Date(jetzt.getTime() + SPERRDAUER_MS));
  });

  it('die Sperre dauert eine Viertelstunde', () => {
    expect(SPERRDAUER_MS).toBe(900_000);
  });
});
