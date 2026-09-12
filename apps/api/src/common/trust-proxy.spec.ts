import { vertrauensStufe, TRUST_PROXY_VORGABE } from './trust-proxy';

describe('vertrauensStufe', () => {
  it('nimmt ohne Angabe die Vorgabe für den Coolify-Aufbau', () => {
    expect(vertrauensStufe(undefined)).toBe(TRUST_PROXY_VORGABE);
    expect(vertrauensStufe('')).toBe(TRUST_PROXY_VORGABE);
    expect(vertrauensStufe('   ')).toBe(TRUST_PROXY_VORGABE);
  });

  it('übernimmt gültige Werte', () => {
    expect(vertrauensStufe('0')).toBe(0);
    expect(vertrauensStufe('1')).toBe(1);
    expect(vertrauensStufe(' 3 ')).toBe(3);
  });

  it('lehnt Unsinn ab, statt still einen falschen Wert zu nehmen', () => {
    expect(() => vertrauensStufe('viele')).toThrow(/ganze Zahl/);
    expect(() => vertrauensStufe('-1')).toThrow(/ganze Zahl/);
    expect(() => vertrauensStufe('1,5')).toThrow(/ganze Zahl/);
    expect(() => vertrauensStufe('1.5')).toThrow(/ganze Zahl/);
  });

  it('nennt den falschen Wert in der Meldung', () => {
    expect(() => vertrauensStufe('abc')).toThrow(/"abc"/);
  });
});
