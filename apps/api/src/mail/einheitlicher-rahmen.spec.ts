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
 * JEDE Mail der Instanz trägt denselben Kopf und dieselbe Fusszeile —
 * gemeinsamer Mailrahmen aus `@soziolog/shared`.
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
  ['Feedback', (m) => m.sendeFeedback('team@b.test', FEEDBACK)],
];

const FEEDBACK = {
  herkunft: 'Solawi Rheintal',
  demo: false,
  seite: '/gesamt-log',
  seitenBezeichnung: 'Gesamt-Log',
  instanz: 'https://solawi.example.test',
  version: '0.7.0',
  datum: '2026-09-15',
  text: 'Erste Zeile\n\nZweite <script>alert(1)</script>',
};

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

  describe('Feedback', () => {
    it('nennt Herkunft, Seite, Datum und Fassung und escaped den Text', async () => {
      await baueDienst().sendeFeedback('team@b.test', FEEDBACK);
      const mail = sendMail.mock.calls[0][0] as {
        to: string;
        subject: string;
        html: string;
        text: string;
        replyTo?: unknown;
      };
      expect(mail.to).toBe('team@b.test');
      expect(mail.subject).toBe('SozioLog – Feedback aus Solawi Rheintal');
      expect(mail.text).toContain('Seite: Gesamt-Log (/gesamt-log)');
      expect(mail.text).toContain('Datum: 15.09.2026');
      expect(mail.text).toContain('App-Fassung: 0.7.0');
      expect(mail.text).toContain('Rückfragen: nicht gewünscht');
      expect(mail.html).toContain('Erste Zeile');
      expect(mail.html).not.toContain('<script>');
      expect(mail.html).toContain('&lt;script&gt;');
      expect(mail.replyTo).toBeUndefined();
    });

    it('setzt die Antwortadresse nur mit Kontakt — als Adressobjekt', async () => {
      await baueDienst().sendeFeedback('team@b.test', {
        ...FEEDBACK,
        kontakt: { name: 'Alex, "Kreis" Nord', email: 'alex@b.test' },
      });
      const mail = sendMail.mock.calls[0][0] as { replyTo: unknown; text: string };
      expect(mail.replyTo).toEqual({ name: 'Alex, "Kreis" Nord', address: 'alex@b.test' });
      expect(mail.text).toContain('Rückfragen: erlaubt – Alex, "Kreis" Nord <alex@b.test>');
    });

    it('schreibt in der Demo keinen Organisationsnamen in den Betreff', async () => {
      await baueDienst().sendeFeedback('team@b.test', {
        ...FEEDBACK,
        demo: true,
        herkunft: 'Eine Person in der Demo',
      });
      const mail = sendMail.mock.calls[0][0] as { subject: string; text: string };
      expect(mail.subject).toBe('SozioLog – Feedback aus der Demo');
      expect(mail.text).toContain('Von: Eine Person in der Demo');
      expect(mail.text).toContain('Rückfragen: nicht möglich (geteiltes Demo-Konto)');
    });

    it('lässt keine Zeilenumbrüche aus dem Namen in den Betreff', async () => {
      await baueDienst().sendeFeedback('team@b.test', {
        ...FEEDBACK,
        herkunft: 'Org\r\nBcc: x@y.test',
      });
      const { subject } = sendMail.mock.calls[0][0] as { subject: string };
      expect(subject).not.toMatch(/[\r\n]/);
    });

    it('legt den Feedbacktext auch ohne SMTP nicht ins Log', async () => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      await baueDienst().sendeFeedback('team@b.test', FEEDBACK);
      const alles = log.mock.calls.map((c) => String(c[0])).join('\n');
      expect(alles).toContain('Feedback an team@b.test');
      expect(alles).not.toContain('Erste Zeile');
    });
  });
});
