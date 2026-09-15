import { describe, expect, it } from 'vitest';
import { seitenBezeichnung, seitenPfad } from './seiten';

describe('seitenBezeichnung', () => {
  it.each([
    ['/', 'Domänen (Übersicht)'],
    ['/domaenen/3f2a-11', 'Domänen-Log'],
    ['/gesamt-log', 'Gesamt-Log'],
    ['/korrekturen-log', 'Korrekturen-Log'],
    ['/statistik', 'Statistik'],
    ['/konto', 'Mein Konto'],
    ['/admin', 'Verwaltung'],
    ['/designsystem', 'Sonstige Seite'],
    ['/domaenen/a/b', 'Sonstige Seite'],
  ])('%s → %s', (pfad, erwartet) => {
    expect(seitenBezeichnung(pfad)).toBe(erwartet);
  });
});

describe('seitenPfad', () => {
  it('lässt einen schlichten Pfad durch', () => {
    expect(seitenPfad('/domaenen/3f2a-11')).toBe('/domaenen/3f2a-11');
  });

  it.each(['/konto?token=x', '/konto#a', 'konto', `/${'a'.repeat(400)}`, '/Domänen'])(
    'fällt bei %s auf die Wurzel zurück',
    (pfad) => {
      expect(seitenPfad(pfad)).toBe('/');
    },
  );
});
