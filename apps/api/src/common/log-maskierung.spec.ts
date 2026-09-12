import { maskiereUrl, MASKE } from './log-maskierung';

describe('maskiereUrl', () => {
  it('lässt URLs ohne Query unverändert', () => {
    expect(maskiereUrl('/api/setup/status')).toBe('/api/setup/status');
  });

  it('maskiert den Einrichtungs-Token', () => {
    expect(maskiereUrl('/api/setup/start?token=abc123')).toBe(
      `/api/setup/start?token=${MASKE}`,
    );
  });

  it('maskiert den Reset-Token', () => {
    expect(maskiereUrl('/passwort-zuruecksetzen?token=geheim')).toBe(
      `/passwort-zuruecksetzen?token=${MASKE}`,
    );
  });

  it('maskiert unabhängig von der Groß-/Kleinschreibung des Namens', () => {
    expect(maskiereUrl('/x?Token=geheim')).toBe(`/x?Token=${MASKE}`);
  });

  it('lässt harmlose Parameter stehen und maskiert nur den Token', () => {
    expect(maskiereUrl('/api/x?seite=2&token=geheim&sortierung=datum')).toBe(
      `/api/x?seite=2&token=${MASKE}&sortierung=datum`,
    );
  });

  it('maskiert mehrere Geheimnisse in einer URL', () => {
    expect(maskiereUrl('/x?token=a&code=b')).toBe(
      `/x?token=${MASKE}&code=${MASKE}`,
    );
  });

  it('kommt mit einem leeren Wert und ohne Gleichheitszeichen zurecht', () => {
    expect(maskiereUrl('/x?token=')).toBe(`/x?token=${MASKE}`);
    expect(maskiereUrl('/x?token')).toBe('/x?token');
  });

  it('gibt einen leeren Query-String unverändert zurück', () => {
    expect(maskiereUrl('/x?')).toBe('/x?');
  });

  /**
   * Review-Hinweis: Der Einladungslink traegt sein Token im PFAD, nicht im
   * Query — die Query-Maskierung allein liess ihn durch.
   */
  it('maskiert den Einladungs-Token im Pfad', () => {
    expect(maskiereUrl('/einladung/abc123')).toBe(`/einladung/${MASKE}`);
    expect(maskiereUrl('/api/einladung/abc123')).toBe(`/api/einladung/${MASKE}`);
  });

  it('behält an, was hinter dem Token folgt', () => {
    expect(maskiereUrl('/api/einladung/abc123/aktivieren')).toBe(
      `/api/einladung/${MASKE}/aktivieren`,
    );
  });

  it('lässt den Einladungspfad ohne Token in Ruhe', () => {
    expect(maskiereUrl('/einladung')).toBe('/einladung');
    expect(maskiereUrl('/einladung/')).toBe('/einladung/');
  });

  it('maskiert Pfad und Query zugleich', () => {
    expect(maskiereUrl('/einladung/abc?token=xyz')).toBe(
      `/einladung/${MASKE}?token=${MASKE}`,
    );
  });
});
