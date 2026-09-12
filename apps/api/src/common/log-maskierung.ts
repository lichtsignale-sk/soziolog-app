/**
 * Maskiert Geheimnisse in der protokollierten Anfrage-URL.
 *
 * WARUM: Zwei Wege dieser API tragen ihr Geheimnis im Query-String — der
 * Einrichtungslink (`/api/setup/start?token=…`) und der Link aus der
 * Passwort-vergessen-Mail (`/passwort-zuruecksetzen?token=…`). Beide sind
 * vollwertige Kontoübernahme-Token. Ohne diese Maskierung stehen sie im Klartext
 * im Anwendungslog (pino protokolliert `req.url`) und zusätzlich im
 * nginx-Zugriffslog. Jeder mit Log-Zugriff könnte damit eine frische Instanz
 * übernehmen oder ein Passwort zurücksetzen.
 *
 * Die Maskierung ersetzt nur die WERTE der bekannten Geheimnis-Parameter. Pfad,
 * Reihenfolge und alle übrigen Parameter bleiben erhalten, damit das Log für die
 * Fehlersuche brauchbar bleibt.
 *
 * Das nginx-Zugriffslog erreicht diese Funktion NICHT — dort muss die Maskierung
 * getrennt in der nginx-Konfiguration erfolgen.
 */

/** Query-Parameter, deren Wert niemals im Log stehen darf. */
export const GEHEIME_PARAMETER = ['token', 'setup-token', 'code'] as const;

/** Platzhalter anstelle des echten Wertes. */
export const MASKE = '<maskiert>';

/**
 * Pfade, bei denen der NAECHSTE Abschnitt das Geheimnis ist.
 *
 * Der Einladungslink traegt sein Token nicht im Query, sondern im Pfad
 * (`${appUrl}/einladung/${token}`, siehe setup.service.ts und
 * admin-personen.controller.ts). Ohne diese Behandlung stuende er unmaskiert im
 * Log — die Query-Maskierung allein greift dort nicht.
 */
export const GEHEIME_PFADE = ['/einladung', '/api/einladung'] as const;

function maskierePfad(pfad: string): string {
  for (const anfang of GEHEIME_PFADE) {
    if (!pfad.startsWith(`${anfang}/`)) continue;
    const rest = pfad.slice(anfang.length + 1);
    if (rest === '') continue;
    // Was hinter dem Token noch folgt (z. B. `/aktivieren`), bleibt sichtbar —
    // es sagt, was versucht wurde, und ist selbst kein Geheimnis.
    const weiter = rest.indexOf('/');
    const schwanz = weiter === -1 ? '' : rest.slice(weiter);
    return `${anfang}/${MASKE}${schwanz}`;
  }
  return pfad;
}

export function maskiereUrl(url: string): string {
  const trenner = url.indexOf('?');
  if (trenner === -1) return maskierePfad(url);

  const pfad = maskierePfad(url.slice(0, trenner));
  const abfrage = url.slice(trenner + 1);
  if (abfrage === '') return `${pfad}?`;

  // Bewusst von Hand statt über URLSearchParams: dessen toString() kodiert die
  // Zeichenkette neu und verändert damit auch unverdächtige Parameter. Für ein
  // Log soll die Zeile so aussehen wie die echte Anfrage.
  const teile = abfrage.split('&').map((paar) => {
    const gleich = paar.indexOf('=');
    if (gleich === -1) return paar;
    const name = paar.slice(0, gleich);
    const istGeheim = (GEHEIME_PARAMETER as readonly string[]).includes(
      name.toLowerCase(),
    );
    return istGeheim ? `${name}=${MASKE}` : paar;
  });

  return `${pfad}?${teile.join('&')}`;
}
