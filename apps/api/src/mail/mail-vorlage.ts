import {
  MAIL_SERIF,
  MAIL_TOKENS,
  escapeMailText,
  mailDokument,
  praeheaderAus,
} from '@soziolog/shared';

/**
 * Der RUMPF der Instanz-Mails — Überschrift, Absätze, Code-Kasten, Knopf.
 *
 * KOPF, KARTE UND FUSSZEILE KOMMEN AUS DEM GEMEINSAMEN MAILRAHMEN
 * (`@soziolog/shared`, `mail-rahmen.ts`), seit dem 12.09.2026: Jede Mail aus
 * SozioLog — Verwaltung wie Instanz — trägt dieselbe Wortmarke im Kopf und
 * dieselbe Anbieterkennung mit Impressum und Datenschutz im Fuss. Vorher
 * hatte die Instanz eine eigene Vorlage mit einem Satz statt der
 * Pflichtangaben.
 */
export interface MailVorlageDaten {
  /** Überschrift oben im Rumpf. */
  titel: string;
  /** Fließtext-Absätze (werden HTML-escaped). */
  absaetze: string[];
  /** Optionaler Call-to-Action-Button. */
  aktion?: { text: string; url: string };
  /** Optionaler hervorgehobener Code (z. B. Login-Code). */
  code?: string;
  /** Optionaler kleingedruckter Hinweis unter dem Inhalt. */
  hinweis?: string;
}

/** Die zarte Primärfläche des Code-Kastens (`--farbe-primaer-soft`). */
const PRIMAER_SOFT = '#e6f0ec';

const esc = escapeMailText;

export function baueHtml(d: MailVorlageDaten): string {
  const t = MAIL_TOKENS;

  const titel =
    `<h1 style="margin:0 0 16px;font-family:${MAIL_SERIF};font-size:20px;` +
    `line-height:1.3;font-weight:700;color:${t.text};">${esc(d.titel)}</h1>`;

  const absaetze = d.absaetze
    .map((p) => `<p style="margin:0 0 14px;color:${t.text};">${esc(p)}</p>`)
    .join('');

  const code = d.code
    ? `<div style="margin:8px 0 18px;padding:16px;text-align:center;` +
      `background-color:${PRIMAER_SOFT};border-radius:10px;">` +
      `<span style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;` +
      `letter-spacing:8px;color:${t.primaer};">${esc(d.code)}</span></div>`
    : '';

  const aktion = d.aktion
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px;">` +
      `<tr><td bgcolor="${t.primaer}" style="border-radius:8px;background-color:${t.primaer};">` +
      `<a href="${esc(d.aktion.url)}" style="display:inline-block;padding:12px 22px;` +
      `font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">` +
      `${esc(d.aktion.text)}</a></td></tr></table>`
    : '';

  const hinweis = d.hinweis
    ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:${t.textLeise};">${esc(d.hinweis)}</p>`
    : '';

  return mailDokument({
    titelHtml: esc(d.titel),
    vorschauHtml: esc(praeheaderAus(d.absaetze.join(' '))),
    rumpfHtml: `${titel}${absaetze}${code}${aktion}${hinweis}`,
  });
}
