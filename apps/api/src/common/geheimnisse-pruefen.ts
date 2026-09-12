/**
 * PRÜFT DIE GEHEIMNISSE BEIM START — und bricht ab, statt weiterzulaufen.
 *
 * WARUM ([A.24]): `.env.example` liefert `JWT_SECRET=change-me`,
 * `SESSION_SECRET=change-me` und `CONFIG_KEY=change-me`. Die Coolify-Dateien
 * erzwingen eigene Werte über `${VAR:?…}`, `docker-compose.prod.yml` aber nicht
 * — eine Installation nach `docs/08-deployment.md` startete klaglos mit
 * `change-me` als Signaturschlüssel der Sitzungen. Wer den Vorgabewert kennt,
 * und das ist jeder mit Zugriff auf dieses öffentliche Repository, kann sich
 * damit gültige Sitzungstoken für JEDE Person ausstellen. Das ist kein
 * Konfigurationsfehler mehr, das ist ein offenes Tor.
 *
 * ABBRUCH STATT WARNUNG: Eine Warnung im Log liest niemand, und die Anwendung
 * liefe weiter — mit einer Anmeldung, die nichts beweist. Ein Start, der
 * scheitert, fällt sofort auf und richtet keinen Schaden an.
 *
 * BEWUSST OHNE JOI: Das wäre eine neue Abhängigkeit für sechs Zeilen Prüfung.
 * `ConfigModule` nimmt mit `validate` auch eine gewöhnliche Funktion.
 *
 * NUR IN PRODUKTION SCHARF: In der Entwicklung soll `pnpm dev` ohne
 * vorbereitete Umgebung laufen; dort sind kurze Werte in Ordnung.
 */

/** Werte, die als Platzhalter im Repository stehen und nie echt sein dürfen. */
export const VERBOTENE_WERTE = [
  'change-me',
  'changeme',
  'geheim',
  'secret',
  'test',
  'nur-fuer-die-entwicklung-bitte-aendern',
];

/** So lang muss ein Geheimnis mindestens sein. */
export const MINDESTLAENGE = 32;

/** Die Werte, ohne die eine Produktivinstanz nicht starten darf. */
export const PFLICHT_GEHEIMNISSE = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'CONFIG_KEY',
] as const;

export function pruefeGeheimnisse(
  umgebung: Record<string, unknown>,
): Record<string, unknown> {
  if (String(umgebung['NODE_ENV'] ?? '') !== 'production') return umgebung;

  const maengel: string[] = [];
  for (const name of PFLICHT_GEHEIMNISSE) {
    // CONFIG_KEY faellt in der Anwendung auf SESSION_SECRET zurueck
    // (konfig.service.ts). Die Pruefung bildet das ab ([Review B2]): Eine
    // Instanz, die bisher ohne CONFIG_KEY lief, startet weiter — und niemand
    // wird verleitet, einen NEUEN Wert zu setzen, mit dem die gespeicherten
    // SMTP-Zugangsdaten unlesbar wuerden.
    const roh =
      name === 'CONFIG_KEY'
        ? (umgebung['CONFIG_KEY'] ?? umgebung['SESSION_SECRET'])
        : umgebung[name];
    const wert = String(roh ?? '').trim();
    if (wert === '') {
      maengel.push(`${name} fehlt.`);
      continue;
    }
    if (VERBOTENE_WERTE.includes(wert.toLowerCase())) {
      maengel.push(
        `${name} steht auf dem Platzhalter "${wert}" aus dem Repository.`,
      );
      continue;
    }
    if (wert.length < MINDESTLAENGE) {
      maengel.push(
        `${name} ist ${wert.length} Zeichen lang, gebraucht werden ` +
          `mindestens ${MINDESTLAENGE}.`,
      );
    }
  }

  if (maengel.length > 0) {
    throw new Error(
      'Die Instanz startet nicht, weil ihre Geheimnisse nicht taugen:\n' +
        maengel.map((m) => `  - ${m}`).join('\n') +
        '\n\nEinen Wert erzeugen: openssl rand -hex 32\n' +
        'ACHTUNG bei CONFIG_KEY: Lief die Instanz bisher ohne diesen Wert, ' +
        'wurde SESSION_SECRET als Schluessel benutzt. Dann CONFIG_KEY auf ' +
        'GENAU den Wert von SESSION_SECRET setzen — ein neuer Wert macht die ' +
        'gespeicherten SMTP-Zugangsdaten unlesbar.\n' +
        'Siehe .env.example und docs/08-deployment.md.',
    );
  }
  return umgebung;
}
