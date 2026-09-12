import { describe, it, expect } from 'vitest';
import { giltAmStichtag } from './gueltigkeit';

describe('giltAmStichtag() – Grenzfälle (gueltigAb inklusive, gueltigBis exklusiv)', () => {
  it('gilt exakt am gueltigAb (inklusive)', () => {
    expect(giltAmStichtag('2026-07-04', null, '2026-07-04')).toBe(true);
  });

  it('gilt NICHT vor gueltigAb', () => {
    expect(giltAmStichtag('2026-07-04', null, '2026-07-03')).toBe(false);
  });

  it('gilt NICHT exakt am gueltigBis (exklusiv)', () => {
    expect(giltAmStichtag('2026-07-01', '2026-07-04', '2026-07-04')).toBe(false);
  });

  it('gilt am Vortag von gueltigBis', () => {
    expect(giltAmStichtag('2026-07-01', '2026-07-04', '2026-07-03')).toBe(true);
  });

  it('gilt unbegrenzt bei gueltigBis == null (weit in der Zukunft)', () => {
    expect(giltAmStichtag('2020-01-01', null, '2999-12-31')).toBe(true);
  });

  it('gilt nicht mehr nach gueltigBis', () => {
    expect(giltAmStichtag('2026-07-01', '2026-07-04', '2026-07-10')).toBe(false);
  });

  it('behandelt Jahreswechsel korrekt (letztgültig am 31.12.)', () => {
    // gültig 2025-12-01 bis 2026-01-01 (exklusiv) → letzter gültiger Tag 2025-12-31
    expect(giltAmStichtag('2025-12-01', '2026-01-01', '2025-12-31')).toBe(true);
    expect(giltAmStichtag('2025-12-01', '2026-01-01', '2026-01-01')).toBe(false);
  });
});
