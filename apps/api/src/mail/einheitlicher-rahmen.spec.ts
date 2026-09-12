import { Logger } from '@nestjs/common';
import {
  HAUS_ANGABEN,
  HAUS_LINKS,
  MAIL_SERIF,
  escapeMailText,
  hausFusszeile,
} from '@soziolog/shared';
import { MailService } from './mail.service';

const sendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

/**
 * JEDE Mail der Instanz trägt denselben Kopf und dieselbe Fusszeile wie die
 * Mails der Verwaltung (12.09.2026) — gemeinsamer Mailrahmen aus
 * `@soziolog/shared`.
 *
 * Geprüft wird jede Versandart einzeln: Eine neue Mail, die am Rahmen vorbei
 * gebaut wird, fällt hier auf, sobald sie in die Liste kommt.
 */
function baueDienst(): MailService {
  const config = {
    get: jest.fn((schluessel: string, vorgabe?: string) => {
      if (schluessel === 'NODE_ENV') return 'test';
      return vorgabe;
    }),
  };
  const konfig = { holeSmtp: jest.fn().mockResolvedValue(null) };
  return new MailService(config as never, konfig as never);
}

const VERSANDARTEN: [string, (m: MailService) => Promise<void>][] = [
  ['Passwort zurücksetzen', (m) => m.sendePasswortReset('a@b.test', 'https://x.test/r?token=t')],
  ['Benachrichtigung', (m) => m.sendeBenachrichtigung('a@b.test', 'Alex', 'beschluss_neu', 'Inhalt')],
  ['Anmeldecode', (m) => m.sendeLoginCode('a@b.test', '123456')],
  ['Einladung', (m) => m.sendeEinladung('a@b.test', 'Alex', 'https://x.test/a?token=t')],
  ['Demo-Zugang', (m) => m.sendeDemoZugang('a@b.test')],
  ['Interne Anfrage', (m) => m.sendeInterneAnfrage('team@b.test', 'Neue Anfrage', ['Zeile'])],
  ['Pilot-Bestätigung', (m) => m.sendePilotBestaetigung('a@b.test', 'Alex')],
  ['Export fertig', (m) => m.sendeExportFertig('a@b.test', 'Alex', Buffer.from('%PDF'), 'export.pdf')],
];

describe('Einheitlicher Mailrahmen — jede Instanz-Mail', () => {
  beforeEach(() => {
    sendMail.mockClear();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(VERSANDARTEN)('%s: Kopf mit Wortmarke, Fusszeile mit Anbieterkennung', async (_, sende) => {
    await sende(baueDienst());

    expect(sendMail).toHaveBeenCalledTimes(1);
    const { html, text } = sendMail.mock.calls[0][0] as { html: string; text: string };

    // Kopf: die Wortmarke in Serife, vor allem anderen Inhalt.
    expect(html).toContain(`font-family:${MAIL_SERIF}`);
    expect(html).toMatch(/>SozioLog<\/p>/);

    // Fusszeile: exakt die des gemeinsamen Rahmens — jede Zeile, jeder Verweis.
    expect(html).toContain(hausFusszeile().html);
    for (const zeile of HAUS_ANGABEN) expect(html).toContain(escapeMailText(zeile));
    for (const l of HAUS_LINKS) expect(html).toContain(`href="${l.url}"`);

    // Und im Textteil, mit ausgeschriebenen Adressen.
    expect(text.endsWith(hausFusszeile().text)).toBe(true);

    // Die alte Einzeiler-Fusszeile ist weg.
    expect(html).not.toContain('Entscheidungs-Logbuch deiner Gemeinschaft');
  });

  it('behält Knopf und Code-Kasten im Rumpf', async () => {
    const dienst = baueDienst();
    await dienst.sendePasswortReset('a@b.test', 'https://x.test/r?token=t');
    await dienst.sendeLoginCode('a@b.test', '654321');
    const [reset, code] = sendMail.mock.calls.map((c) => (c[0] as { html: string }).html);
    expect(reset).toContain('href="https://x.test/r?token=t"');
    expect(reset).toContain('Neues Passwort setzen');
    expect(code).toContain('654321');
  });
});
