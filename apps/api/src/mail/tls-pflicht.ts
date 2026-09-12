/**
 * Verschlüsselung des Postausgangs ist in Produktion nicht abschaltbar.
 *
 * `SMTP_TLS_ERZWINGEN=0` setzt `requireTLS` aus. Über diese Verbindung gehen
 * die PASSWORT-RESET-LINKS hinaus — wer einen davon mitliest, übernimmt das
 * Konto vollständig, ohne das alte Passwort zu kennen. Daneben laufen der
 * sechsstellige Anmeldecode der E-Mail-Zwei-Faktor-Anmeldung, die
 * Aktivierungslinks frisch eingeladener Personen und `SMTP_USER`/`SMTP_PASS`
 * über dieselbe Verbindung. Ohne erzwungenes STARTTLS genügt es, die
 * Fähigkeit aus der EHLO-Antwort zu streichen, und nodemailer verschickt alles
 * im Klartext.
 *
 * Deshalb ein STARTABBRUCH und keine Log-Warnung: eine Sicherheitsmaßnahme,
 * die sich per Umgebungsvariable abschalten lässt, wird irgendwann bei einer
 * Fehlersuche abgeschaltet und nie wieder eingeschaltet.
 *
 * Die Ausnahme für die Entwicklung hängt bewusst an `NODE_ENV` und nicht an
 * einer Hostnamen-Heuristik: „localhost ist schon in Ordnung" wäre genau die
 * Bequemlichkeit, die diese Prüfung verhindern soll.
 */
export function pruefeTlsPflicht(
  nodeEnv: string | undefined,
  tlsErzwingen: string | undefined,
): void {
  if (nodeEnv !== 'production') return;
  // Nur der ausdrückliche Wert "0" schaltet ab (siehe transport.ts); alles
  // andere, auch „nicht gesetzt", bedeutet erzwungen.
  if ((tlsErzwingen ?? '1') !== '0') return;

  throw new Error(
    'SMTP_TLS_ERZWINGEN=0 ist bei NODE_ENV=production nicht zulässig. ' +
      'Über den Postausgang gehen die Passwort-Reset-Links hinaus — das sind ' +
      'vollwertige Kontoübernahme-Token —, dazu der Anmeldecode der ' +
      'Zwei-Faktor-Anmeldung sowie SMTP_USER und SMTP_PASS. Ohne erzwungenes ' +
      'STARTTLS können alle im Klartext übertragen werden; es genügt ein ' +
      'Postausgang, der STARTTLS nicht anbietet. Entweder SMTP_TLS_ERZWINGEN ' +
      'entfernen (Vorgabe: erzwungen) oder einen Postausgang einsetzen, der ' +
      'Verschlüsselung beherrscht. Die Abschaltung ist ausschließlich für die ' +
      'lokale Entwicklung gegen Mailpit gedacht, das kein STARTTLS spricht.',
  );
}
