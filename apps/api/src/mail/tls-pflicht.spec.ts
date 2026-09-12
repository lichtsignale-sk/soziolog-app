import { pruefeTlsPflicht } from './tls-pflicht';

/**
 * Die Abschaltung der Transportverschlüsselung ist in Produktion ein
 * Startabbruch, keine Warnung. Der Test hält beide Richtungen fest: dass
 * abgebrochen wird, UND dass die lokale Entwicklung weiterläuft — sonst wäre
 * der Schutz zwar da, aber der Docker-Stack gegen Mailpit kaputt.
 */
describe('SMTP_TLS_ERZWINGEN in Produktion', () => {
  it('bricht bei NODE_ENV=production und SMTP_TLS_ERZWINGEN=0 ab', () => {
    expect(() => pruefeTlsPflicht('production', '0')).toThrow(
      /SMTP_TLS_ERZWINGEN/,
    );
  });

  it('nennt die Variable beim Namen und sagt, warum es sie gibt', () => {
    // Eine Fehlermeldung, die nur „ungültige Konfiguration" sagt, führt bei
    // der nächsten Fehlersuche wieder zum Abschalten.
    let meldung = '';
    try {
      pruefeTlsPflicht('production', '0');
    } catch (fehler) {
      meldung = fehler instanceof Error ? fehler.message : String(fehler);
    }
    expect(meldung).toContain('SMTP_TLS_ERZWINGEN=0');
    expect(meldung).toContain('NODE_ENV=production');
    expect(meldung).toContain('Passwort-Reset-Links');
    expect(meldung).toContain('SMTP_PASS');
    // Und sie muss sagen, was zu tun ist.
    expect(meldung).toContain('Mailpit');
  });

  it('lässt Produktion mit erzwungener Verschlüsselung durch', () => {
    expect(() => pruefeTlsPflicht('production', '1')).not.toThrow();
  });

  it('behandelt „nicht gesetzt" in Produktion als erzwungen', () => {
    // Die Vorgabe in transport.ts ist '1'. Fehlt die Variable, ist alles gut —
    // sonst könnte niemand ohne sie starten.
    expect(() => pruefeTlsPflicht('production', undefined)).not.toThrow();
    expect(() => pruefeTlsPflicht('production', '')).not.toThrow();
  });

  it('wertet NUR die ausdrückliche 0 als Abschaltung — wie transport.ts', () => {
    // Würde der Wächter strenger lesen als der Transport, bräche der Start bei
    // Werten ab, die gar nichts abschalten.
    for (const wert of ['false', 'nein', 'off', '00', ' 0']) {
      expect(() => pruefeTlsPflicht('production', wert)).not.toThrow();
    }
  });

  it('LÄSST DIE LOKALE ENTWICKLUNG DURCH — sonst startet der Docker-Stack nicht', () => {
    // Genau der Fall aus docker-compose.yml: Mailpit spricht kein STARTTLS.
    expect(() => pruefeTlsPflicht('development', '0')).not.toThrow();
    expect(() => pruefeTlsPflicht(undefined, '0')).not.toThrow();
    expect(() => pruefeTlsPflicht('test', '0')).not.toThrow();
  });
});
