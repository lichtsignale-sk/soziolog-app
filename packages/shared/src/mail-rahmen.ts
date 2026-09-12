/**
 * ===========================================================================
 * DER GEMEINSAME MAILRAHMEN — Kopf, Karte, Fusszeile
 * ===========================================================================
 *
 * JEDE Mail aus SozioLog trägt denselben Kopf (die Wortmarke „SozioLog" in
 * Serife) und dieselbe Fusszeile (die Anbieterkennung mit Impressum und
 * Datenschutz) — gleich, welche Anwendung sie verschickt
 * („Passwort zurücksetzen", Einladung, Anmeldecode, Benachrichtigung …).
 *
 * WARUM HIER. Zwei Fassungen derselben Marke laufen auseinander — eine
 * Vorlage mit Anbieterkennung und eine mit einem Satz statt der
 * Pflichtangaben. Deshalb gibt es genau eine Quelle, und jede Anwendung
 * rendert daraus.
 *
 * WAS HIER NICHT STEHT: der Rumpf. Wie ein Rumpf entsteht, entscheidet jede
 * Anwendung selbst — die Instanz etwa setzt Knopf und Code-Kasten. Der Rahmen nimmt den
 * fertigen Rumpf und legt Kopf und Fusszeile darum. Die Hausangaben setzt er
 * SELBST ein; es gibt keinen Parameter, mit dem ein Aufrufer sie weglassen
 * könnte.
 *
 * Tabellenlayout und Inline-Stile, weil E-Mail-Programme weder Flexbox noch
 * eine verlässliche Kaskade kennen. Jede Fläche trägt ihre Farbe doppelt (als
 * `bgcolor` und als `background-color`), und Text- und Flächenfarbe stehen
 * immer als Paar: Manche Programme drehen eigenmächtig auf dunkel um und
 * erwischen dabei nur eine der beiden Angaben.
 */

/**
 * Die Farbwerte der Marke — abgeschrieben aus `packages/ui/src/tokens.css`.
 * Eine E-Mail lädt kein Stylesheet; die Werte müssen im Quelltext stehen.
 * Wer dort einen Wert ändert, ändert ihn hier mit.
 */
export const MAIL_TOKENS = {
  /** `--farbe-flaeche` — die Karte, auf der die Mail steht. */
  flaeche: '#ffffff',
  /** `--farbe-flaeche-2` — der Hintergrund um die Karte herum. */
  flaeche2: '#f6f7f5',
  /** `--farbe-text` — Fliesstext. */
  text: '#1e2621',
  /** `--farbe-text-leise` — Fusszeile und Nebensätze. */
  textLeise: '#54605a',
  /** `--farbe-rahmen` — Kartenrand und Trennlinie über der Fusszeile. */
  rahmen: '#e3e7e1',
  /** `--farbe-primaer` — Wortmarke und Verweise. */
  primaer: '#3a7d6b',
  /** `--farbe-flaeche-4` — die abgesetzte Fläche der Fusszeile. */
  flaeche4: '#fbfcfb',
} as const;

/**
 * Serife für Wortmarke und Überschriften. Georgia ist auf praktisch jedem
 * Gerät installiert — anders als ein Webfont kommt sie in der Mail an.
 */
export const MAIL_SERIF = "Georgia, 'Times New Roman', 'Nimbus Roman', serif";

/**
 * Die Grundschrift. EINFACHE Anführungszeichen um „Segoe UI": Der Wert steht
 * in `style="…"`-Attributen, und doppelte hätten das Attribut vorzeitig
 * beendet — so geschehen in jeder Mail, bis ein Test das geparste Dokument
 * prüfte.
 */
export const MAIL_SCHRIFT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Alle Farbwerte als flache Liste — für Tests, die rohe Hex-Werte suchen. */
export const MAIL_FARBWERTE: readonly string[] = Object.values(MAIL_TOKENS);

/**
 * Die Anbieterkennung — wer diese Mail geschickt hat (§ 5 DDG; für
 * Geschäftsbriefe der GmbH & Co KG § 125a i. V. m. § 177a HGB).
 *
 * ALS KONSTANTE, NICHT AUS DER UMGEBUNG: Eine Pflichtangabe, die bei einer
 * vergessenen Variablen still verschwindet, wäre schlimmer als eine, die man
 * zum Ändern neu ausrollen muss. Wer SozioLog unter eigenem Namen betreibt,
 * trägt hier die eigenen Pflichtangaben ein.
 */
export const HAUS_ANGABEN: readonly string[] = [
  'Lichtsignale GmbH & Co KG, De-Gasperi-Str. 5, 36039 Fulda',
  'Sitz Fulda · Amtsgericht Fulda HRA 6666',
  'Persönlich haftende Gesellschafterin: Lichtsignale Management GmbH,',
  'Sitz Fulda, Amtsgericht Fulda HRB 8967',
  'Geschäftsführer: Samuel Kümmel, Simon Malz, Tobias Stüttgen',
  'USt-IdNr. DE258555957 · Telefon +49 151 15704725 · hallo@soziolog.com',
];

/**
 * Die Verweise der Fusszeile. GENAU DREI, alle ohne Parameter — eine
 * Anbieterkennung ist keine Messstelle. Absolut, weil es in einer Mail keine
 * relative Auflösung gibt.
 */
export const HAUS_URL = 'https://soziolog.com';
export const HAUS_LINKS: readonly { text: string; url: string }[] = [
  { text: 'soziolog.com', url: HAUS_URL },
  { text: 'Impressum', url: `${HAUS_URL}/impressum` },
  { text: 'Datenschutz', url: `${HAUS_URL}/datenschutz` },
];

/** Escaped Text für die Einbettung in HTML (Inhalt wie Attribut). */
export function escapeMailText(wert: string): string {
  return wert
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ein Fusszeilenblock, fertig in beiden Fassungen. */
export interface MailFusszeile {
  html: string;
  text: string;
}

/**
 * Die Anbieterkennung als Fusszeile — OHNE ARGUMENTE. Ein Parameter wäre der
 * Schalter, über den sich eines Tages ein Abmeldelink oder ein
 * Redaktionstext hineinreichen liesse.
 */
export function hausFusszeile(): MailFusszeile {
  const t = MAIL_TOKENS;
  const verweise = HAUS_LINKS.map(
    (l) =>
      `<a href="${escapeMailText(l.url)}" style="color:${t.textLeise};">` +
      `${escapeMailText(l.text)}</a>`,
  ).join(' &middot; ');

  const html = [
    `<p style="margin:0 0 8px;font-size:12px;color:${t.textLeise};">`,
    HAUS_ANGABEN.map((zeile) => escapeMailText(zeile)).join('<br>'),
    '</p>',
    `<p style="margin:0;font-size:12px;color:${t.textLeise};">`,
    verweise,
    '</p>',
  ].join('');

  // Im Textteil die Adressen ausgeschrieben: Ein Linktext ohne Adresse ist
  // dort wertlos.
  const text = [...HAUS_ANGABEN, '', ...HAUS_LINKS.map((l) => l.url)].join('\n');

  return { html, text };
}

/** Wie viele Zeichen der abgeleitete Vorschautext höchstens hat. */
const PRAEHEADER_ZEICHEN = 90;

/** Kürzt einen Text auf einen brauchbaren Vorschautext (Postfachliste). */
export function praeheaderAus(text: string): string {
  const eineZeile = text.replace(/\s+/g, ' ').trim();
  if (eineZeile.length <= PRAEHEADER_ZEICHEN) return eineZeile;
  const gekuerzt = eineZeile.slice(0, PRAEHEADER_ZEICHEN);
  const luecke = gekuerzt.lastIndexOf(' ');
  // Lieber am letzten ganzen Wort abschneiden als mitten hinein.
  return `${luecke > 40 ? gekuerzt.slice(0, luecke) : gekuerzt}…`;
}

export interface MailDokumentTeile {
  /** Der `<title>` — BEREITS als HTML escaped (jede App escaped selbst). */
  titelHtml: string;
  /** Der Vorschautext — BEREITS escaped. */
  vorschauHtml: string;
  /** Der fertige Rumpf als HTML. Für seinen Inhalt steht der Aufrufer ein. */
  rumpfHtml: string;
  /**
   * Ein Block ÜBER den Hausangaben — etwa eine werbliche Fusszeile
   * (Einwilligung, Abmeldelink). Die Hausangaben stehen immer.
   */
  zusatzFusszeileHtml?: string;
}

/**
 * Das HTML-Dokument: Kopf mit Wortmarke, Rumpf, Fusszeile auf eigener Fläche.
 *
 * DIE REIHENFOLGE IN DER FUSSZEILE IST PFLICHT: der Zusatz zuerst, die
 * Hausangaben darunter — so wie in `mailText`.
 */
export function mailDokument(teile: MailDokumentTeile): string {
  const t = MAIL_TOKENS;
  const haus = hausFusszeile();
  const fusszeileHtml =
    teile.zusatzFusszeileHtml !== undefined
      ? `${teile.zusatzFusszeileHtml}<div style="height:16px;line-height:16px;">&nbsp;</div>${haus.html}`
      : haus.html;

  return [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    // Die Anwendung hat keinen Dunkelmodus; eine Mail, die einen erfindet,
    // wäre eine Markenentscheidung ohne Auftrag.
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${teile.titelHtml}</title>`,
    '<style>',
    // Die EINZIGE Regel im Stylesheet: schmalere Innenabstände auf kleinen
    // Bildschirmen. Wer sie nicht versteht, ignoriert sie.
    '@media screen and (max-width:480px){',
    '.sl-innen{padding-left:20px !important;padding-right:20px !important;}',
    '}',
    '</style>',
    '</head>',
    `<body style="margin:0;padding:0;background-color:${t.flaeche2};` +
      `color:${t.text};">`,
    // Vorschautext: unsichtbar im Dokument, sichtbar in der Postfachliste.
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;' +
      `mso-hide:all;">${teile.vorschauHtml}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `border="0" bgcolor="${t.flaeche2}" ` +
      `style="background-color:${t.flaeche2};border-collapse:collapse;">`,
    '<tr><td align="center" style="padding:32px 16px;">',
    // `table-layout:fixed` UND Umbruchregeln in den Zellen: `max-width` auf
    // einem `<table>` ist keine harte Grenze, ein langer Link zöge die Karte
    // sonst auseinander.
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `border="0" bgcolor="${t.flaeche}" ` +
      `style="max-width:600px;background-color:${t.flaeche};` +
      `border:1px solid ${t.rahmen};border-radius:12px;` +
      'border-collapse:separate;table-layout:fixed;">',
    // KOPF: die Wortmarke als Text, in Serife. Kein Bild — Bilder laden viele
    // Postfächer erst auf Nachfrage.
    `<tr><td class="sl-innen" style="padding:28px 32px 20px;">`,
    `<p style="margin:0;font-family:${MAIL_SERIF};font-size:20px;` +
      `line-height:1.3;font-weight:700;color:${t.primaer};">SozioLog</p>`,
    '</td></tr>',
    // RUMPF. `word-break` für Outlooks Word-Renderer, `overflow-wrap` für
    // alle anderen.
    `<tr><td class="sl-innen" style="padding:0 32px 28px;font-family:${MAIL_SCHRIFT};` +
      `font-size:15.5px;line-height:1.6;color:${t.text};` +
      'word-break:break-word;overflow-wrap:anywhere;">',
    teile.rumpfHtml,
    '</td></tr>',
    // FUSSZEILE auf eigener Fläche: sichtbar ein anderer Teil als der Rumpf.
    `<tr><td class="sl-innen" bgcolor="${t.flaeche4}" ` +
      `style="padding:20px 32px 28px;background-color:${t.flaeche4};` +
      `border-top:1px solid ${t.rahmen};font-family:${MAIL_SCHRIFT};` +
      `font-size:12.5px;line-height:1.6;color:${t.textLeise};` +
      'word-break:break-word;overflow-wrap:anywhere;">',
    fusszeileHtml,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}

/** Der Textteil: Rumpf, darunter (optional) der Zusatz, dann die Hausangaben. */
export function mailText(rumpfText: string, zusatzFusszeileText?: string): string {
  const haus = hausFusszeile();
  const fuss =
    zusatzFusszeileText !== undefined ? `${zusatzFusszeileText}\n\n${haus.text}` : haus.text;
  return `${rumpfText.trimEnd()}\n\n${fuss}`;
}
