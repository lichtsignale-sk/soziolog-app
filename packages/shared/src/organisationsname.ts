/**
 * DER VERGLEICH DES ORGANISATIONSNAMENS ÜBER DIE SYSTEMGRENZE — OHNE DEN NAMEN.
 *
 * Wer mehrere Instanzen zentral beobachtet, will prüfen können, ob der
 * Organisationsname einer Instanz dem erwarteten Namen entspricht. Der
 * Kennzahlen-Endpunkt liefert aber bewusst keinerlei Inhalt, ausdrücklich
 * auch keine Namen — nur Zählwerte.
 *
 * Beides zugleich geht so: Die beobachtende Seite schickt einen ABDRUCK des
 * Namens, den sie erwartet, und die Instanz antwortet mit `true` oder
 * `false`. Über die Leitung geht damit kein Name — in keine Richtung. Ein
 * Boolean ist kein Inhalt.
 *
 * WAS DER ABDRUCK NICHT IST: eine Absicherung gegen Erraten. Wer den Namen
 * einer Organisation kennt, kann seinen Abdruck bilden — der Namensraum ist
 * klein. Das ist hier ohne Belang: Der Abdruck schützt nichts, er vermeidet
 * nur, dass ein Name übertragen und gespeichert wird, wo er nicht hingehört.
 *
 * DIE NORMALISIERUNG MUSS AUF BEIDEN SEITEN DIESELBE SEIN. Läuft sie
 * auseinander, meldet der Abgleich für JEDE Instanz eine Abweichung, und die
 * Meldung wird zur Gewohnheit. Deshalb steht sie hier in `packages/shared` und
 * nicht zweimal.
 */

/**
 * Reduziert einen Organisationsnamen auf seinen vergleichbaren Kern.
 *
 * Kleinschreibung, Umlaute aufgelöst, alles weg, was kein Buchstabe und keine
 * Ziffer ist. Damit gelten „Musterverein Ostend e. V.", „Musterverein Ostend
 * e.V." und „musterverein ostend eV" als derselbe Name — das sind
 * Schreibweisen, keine Umfirmierungen, und ein Alarm dafür wäre ein Fehlalarm.
 * „Wohnprojekt Grünzug" dagegen ist ein anderer Name und soll auffallen.
 */
export function normalisiereOrganisationsname(name: string): string {
  const umlaute: Record<string, string> = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    ß: 'ss',
  };
  let ersetzt = '';
  for (const zeichen of name.toLowerCase()) {
    ersetzt += umlaute[zeichen] ?? zeichen;
  }
  return ersetzt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Der Abdruck eines Organisationsnamens als Hex-SHA-256.
 *
 * Bewusst ohne `crypto`-Import, damit dieses Paket in Node UND im Browser
 * benutzbar bleibt: Der Aufrufer reicht die Hash-Funktion herein. In der API
 * ist das `createHash('sha256')` aus Node.
 */
export function organisationsnameAbdruck(
  name: string,
  hash: (wert: string) => string,
): string {
  return hash(normalisiereOrganisationsname(name));
}
