import { describe, expect, it } from 'vitest';
import {
  HAUS_ANGABEN,
  HAUS_LINKS,
  MAIL_SERIF,
  escapeMailText,
  hausFusszeile,
  mailDokument,
  mailText,
  praeheaderAus,
} from './mail-rahmen';

const TEILE = { titelHtml: 'Betreff', vorschauHtml: 'Vorschau', rumpfHtml: '<p>Rumpf</p>' };

describe('Der gemeinsame Mailrahmen', () => {
  it('trägt im Kopf die Wortmarke „SozioLog" in Serife', () => {
    const html = mailDokument(TEILE);
    expect(html).toContain(`font-family:${MAIL_SERIF}`);
    expect(html).toMatch(/>SozioLog<\/p>/);
    // Kopf VOR Rumpf.
    expect(html.indexOf('>SozioLog</p>')).toBeLessThan(html.indexOf('<p>Rumpf</p>'));
  });

  it('setzt die Anbieterkennung immer ein — jede Zeile und alle Verweise', () => {
    const html = mailDokument(TEILE);
    for (const zeile of HAUS_ANGABEN) expect(html).toContain(escapeMailText(zeile));
    for (const l of HAUS_LINKS) expect(html).toContain(`href="${l.url}"`);
    expect(html).toContain(hausFusszeile().html);
  });

  it('stellt einen Zusatz ÜBER die Hausangaben, in HTML und Text', () => {
    const html = mailDokument({ ...TEILE, zusatzFusszeileHtml: '<p>ZUSATZ</p>' });
    expect(html.indexOf('ZUSATZ')).toBeLessThan(html.indexOf(escapeMailText(HAUS_ANGABEN[0])));

    const text = mailText('Rumpf', 'ZUSATZ');
    expect(text.indexOf('ZUSATZ')).toBeLessThan(text.indexOf(HAUS_ANGABEN[0]));
  });

  it('hängt die Hausangaben an den Textteil — mit ausgeschriebenen Adressen', () => {
    const text = mailText('Hallo,\n\nRumpf.\n\n\n');
    expect(text.startsWith('Hallo,\n\nRumpf.\n\n')).toBe(true);
    for (const zeile of HAUS_ANGABEN) expect(text).toContain(zeile);
    for (const l of HAUS_LINKS) expect(text).toContain(l.url);
  });

  it('escaped Titel und Vorschau nicht selbst — das tut der Aufrufer', () => {
    expect(mailDokument({ ...TEILE, titelHtml: 'A &amp; B' })).toContain('<title>A &amp; B</title>');
  });

  it('kürzt den Vorschautext am letzten ganzen Wort', () => {
    const lang = 'wort '.repeat(40);
    const kurz = praeheaderAus(lang);
    expect(kurz.endsWith('…')).toBe(true);
    expect(kurz.length).toBeLessThanOrEqual(91);
    expect(praeheaderAus('  kurz   und\nknapp ')).toBe('kurz und knapp');
  });
});
