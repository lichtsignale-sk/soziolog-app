import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  heute,
  datumAusString,
  zuDatum,
  datumPlusTage,
  datumStringAusDate,
  monatAusDatum,
} from './datum';

afterEach(() => {
  vi.useRealTimers();
});

describe('heute()', () => {
  it('gibt einen String im Format YYYY-MM-DD zurück', () => {
    expect(heute()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gibt das aktuelle Jahr zurück', () => {
    const [year] = heute().split('-').map(Number);
    expect(year).toBe(new Date().getFullYear());
  });

  it('gibt bei 23:59:59 Lokalzeit das korrekte Datum zurück (kein UTC-Shift)', () => {
    // new Date(y, m, d, h, min, s) = lokale Zeit → getDate() muss denselben Tag liefern
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 23, 59, 59));
    expect(heute()).toBe('2024-01-15');
  });

  it('gibt bei 00:00:30 Lokalzeit das korrekte Datum zurück', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 30, 0, 0, 30));
    expect(heute()).toBe('2024-06-30');
  });

  it('nutzt lokale Zeitfelder (getFullYear/getMonth/getDate), nicht UTC-Äquivalente', () => {
    // Klassischer Bug: new Date().toISOString().split('T')[0] liefert UTC-Datum,
    // das in UTC+ Zonen stimmt, in UTC- Zonen aber um 1 Tag nach hinten springt.
    // Sicherstellung: getDate() == heute().split('-')[2]
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 31, 23, 45, 0)); // 31. Dez Lokalzeit
    const result = heute();
    const [, , day] = result.split('-').map(Number);
    expect(day).toBe(new Date().getDate()); // lokaler Tag, nicht UTC-Tag
    expect(result).toBe('2025-12-31');
  });
});

describe('datumAusString()', () => {
  it('gibt gültige Datumsstrings unverändert zurück', () => {
    expect(datumAusString('2024-01-15')).toBe('2024-01-15');
    expect(datumAusString('2000-12-31')).toBe('2000-12-31');
  });

  it('wirft bei falschem Trennzeichen', () => {
    expect(() => datumAusString('2024/01/15')).toThrow('Ungültiges Datumsformat');
  });

  it('wirft bei fehlendem Datumsanteil', () => {
    expect(() => datumAusString('2024-01')).toThrow('Ungültiges Datumsformat');
  });

  it('wirft bei unmöglichem Datum (31. Februar)', () => {
    expect(() => datumAusString('2024-02-31')).toThrow('Ungültiges Datum');
  });

  it('wirft bei Monat 13', () => {
    expect(() => datumAusString('2024-13-01')).toThrow('Ungültiges Datum');
  });

  it('wirft bei Tag 0', () => {
    expect(() => datumAusString('2024-01-00')).toThrow('Ungültiges Datum');
  });
});

describe('zuDatum()', () => {
  it('erzeugt UTC-Mitternacht des angegebenen Kalendertags (Prisma @db.Date)', () => {
    const d = zuDatum('2024-01-15');
    // UTC-Felder, denn Prisma speichert/liest DATE in UTC.
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
    expect(d.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('rutscht in UTC+ Zeitzonen NICHT auf den Vortag (Zeitzonen-Falle)', () => {
    // Der Kalendertag in UTC muss exakt der Eingabe entsprechen – unabhängig
    // von lokaler Zeitzone/Systemzeit.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 31, 23, 45, 0));
    const d = zuDatum('2025-12-31');
    expect(d.getUTCDate()).toBe(31);
    expect(d.getUTCMonth()).toBe(11);
    expect(d.toISOString()).toBe('2025-12-31T00:00:00.000Z');
  });

  it('wirft bei ungültigem Datum', () => {
    expect(() => zuDatum('2024-02-31')).toThrow('Ungültiges Datum');
  });
});

describe('datumStringAusDate()', () => {
  it('ist die Umkehrung von zuDatum (round-trip)', () => {
    expect(datumStringAusDate(zuDatum('2026-07-04'))).toBe('2026-07-04');
  });

  it('liest UTC-Mitternacht korrekt zurück', () => {
    const d = new Date('2024-02-29T00:00:00.000Z');
    expect(datumStringAusDate(d)).toBe('2024-02-29');
  });
});

describe('datumPlusTage()', () => {
  it('addiert einen Tag (Folgetag)', () => {
    expect(datumPlusTage('2024-01-15', 1)).toBe('2024-01-16');
  });

  it('rechnet über Monatsgrenzen', () => {
    expect(datumPlusTage('2024-01-31', 1)).toBe('2024-02-01');
  });

  it('rechnet über Jahresgrenzen', () => {
    expect(datumPlusTage('2024-12-31', 1)).toBe('2025-01-01');
  });

  it('berücksichtigt Schaltjahre (29. Februar 2024)', () => {
    expect(datumPlusTage('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('subtrahiert bei negativem Wert', () => {
    expect(datumPlusTage('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('gibt bei 0 dasselbe Datum zurück', () => {
    expect(datumPlusTage('2024-06-15', 0)).toBe('2024-06-15');
  });
});

describe('monatAusDatum()', () => {
  it('leitet den Monat aus dem Kalendertag ab (YYYY-MM)', () => {
    expect(monatAusDatum('2026-07-04')).toBe('2026-07');
  });

  it('verschiebt an Monatsgrenzen nichts (letzter Tag des Monats)', () => {
    expect(monatAusDatum('2026-01-31')).toBe('2026-01');
    expect(monatAusDatum('2026-12-01')).toBe('2026-12');
  });

  it('wirft bei ungültigem Datum', () => {
    expect(() => monatAusDatum('2024-02-31')).toThrow('Ungültiges Datum');
  });
});
