import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { mailText, type BenachrichtigungTyp } from '@soziolog/shared';
import { KonfigService } from '../konfig/konfig.service';
import { baueHtml } from './mail-vorlage';
import { baueTransport, tlsErzwungen } from './transport';

const BENACHRICHTIGUNG_BETREFF: Record<BenachrichtigungTyp, string> = {
  ueberpruefung_faellig: 'SozioLog – Überprüfung fällig',
  korrektur_beantragt: 'SozioLog – Neuer Korrekturantrag',
  korrektur_bestaetigt: 'SozioLog – Korrektur bestätigt',
  korrektur_abgelehnt: 'SozioLog – Korrektur abgelehnt',
  vorschlag_neu: 'SozioLog – Neuer Vorschlag',
  beschluss_neu: 'SozioLog – Neuer Beschluss',
};

/** Kurztitel (ohne „SozioLog –"-Präfix) für die HTML-Überschrift. */
const BENACHRICHTIGUNG_TITEL: Record<BenachrichtigungTyp, string> = {
  ueberpruefung_faellig: 'Überprüfung fällig',
  korrektur_beantragt: 'Neuer Korrekturantrag',
  korrektur_bestaetigt: 'Korrektur bestätigt',
  korrektur_abgelehnt: 'Korrektur abgelehnt',
  vorschlag_neu: 'Neuer Vorschlag',
  beschluss_neu: 'Neuer Beschluss',
};

interface Transport {
  transporter: nodemailer.Transporter;
  absender: string;
  nurLog: boolean;
}

/**
 * Versendet E-Mails per Nodemailer. Die SMTP-Zugangsdaten kommen bevorzugt aus
 * der (verschlüsselten) Systemkonfiguration (nach dem Setup), sonst aus den
 * Env-Variablen SMTP_*. Ist gar nichts konfiguriert, wird jsonTransport benutzt
 * und die Mail inkl. Link nur in die Server-Konsole geloggt (Dev-Komfort).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Die Warnung zur abgeschalteten Verschlüsselung nur einmal pro Prozess. */
  private tlsWarnungGezeigt = false;

  constructor(
    private readonly config: ConfigService,
    private readonly konfig: KonfigService,
  ) {}

  /**
   * Baut den Transport pro Versand – so wirkt eine im Setup gesetzte SMTP-Konfig sofort.
   *
   * Beide Quellen (Setup-Konfiguration und Umgebung) gehen durch dieselbe
   * Stelle in `transport.ts`; die Verschlüsselungspflicht gilt damit für den
   * im Setup eingetragenen Postausgang genauso wie für den aus der Umgebung.
   */
  private async transport(): Promise<Transport> {
    const erzwungen = tlsErzwungen(this.config);
    if (!erzwungen && !this.tlsWarnungGezeigt) {
      this.tlsWarnungGezeigt = true;
      this.logger.warn(
        'SMTP_TLS_ERZWINGEN=0: Passwort-Reset-Links, Anmeldecodes und ' +
          'SMTP-Zugangsdaten können unverschlüsselt übertragen werden. Nur ' +
          'für lokale Entwicklung (Mailpit ohne STARTTLS) vorgesehen.',
      );
    }

    const gespeichert = await this.konfig.holeSmtp();
    if (gespeichert) {
      return {
        nurLog: false,
        absender: gespeichert.absender,
        transporter: baueTransport(
          {
            host: gespeichert.host,
            port: gespeichert.port,
            user: gespeichert.user,
            passwort: gespeichert.passwort,
          },
          erzwungen,
        ),
      };
    }

    const envHost = this.config.get<string>('SMTP_HOST');
    const absender = this.config.get<string>(
      'SMTP_FROM',
      'SozioLog <noreply@example.com>',
    );
    if (envHost) {
      return {
        nurLog: false,
        absender,
        transporter: baueTransport(
          {
            host: envHost,
            port: Number(this.config.get<string | number>('SMTP_PORT', 587)),
            user: this.config.get<string>('SMTP_USER'),
            passwort: this.config.get<string>('SMTP_PASS'),
          },
          erzwungen,
        ),
      };
    }

    return {
      nurLog: true,
      absender,
      transporter: nodemailer.createTransport({ jsonTransport: true }),
    };
  }

  private async versende(
    email: string,
    betreff: string,
    text: string,
    html: string,
    devHinweis: string,
    anhaenge?: { filename: string; content: Buffer; contentType?: string }[],
  ): Promise<void> {
    const { transporter, absender, nurLog } = await this.transport();
    await transporter.sendMail({
      from: absender,
      to: email,
      subject: betreff,
      // Die Hausangaben auch im Textteil — dieselbe Fusszeile wie im HTML
      // (gemeinsamer Mailrahmen, `@soziolog/shared`).
      text: mailText(text),
      html,
      attachments: anhaenge,
    });
    if (nurLog) {
      // Ohne SMTP faellt nodemailer auf jsonTransport zurueck: Die Mail geht
      // nirgends hin. In der Entwicklung ist der Link im Log genau richtig —
      // anders kaeme man nicht an ihn heran.
      //
      // IN PRODUKTION NIEMALS: `devHinweis` enthaelt bei Passwort-Reset und
      // Einladung den vollstaendigen Link samt Token, also einen
      // Kontouebernahme-Ausweis. Er stuende dauerhaft im Container-Log. Dort
      // stattdessen eine Warnung ohne Geheimnis — und die ist ohnehin das
      // Wichtigere, denn die Person hat gar keine Mail bekommen.
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error(
          `Kein SMTP-Server eingerichtet: Die Mail "${betreff}" wurde NICHT ` +
            'versendet. SMTP_HOST setzen und die Instanz neu starten.',
        );
      } else {
        this.logger.log(`[DEV-MAIL] ${devHinweis}`);
      }
    }
  }

  async sendePasswortReset(email: string, resetUrl: string): Promise<void> {
    const text =
      `Hallo,\n\ndu (oder jemand) hat für dein SozioLog-Konto ein neues Passwort ` +
      `angefordert. Öffne den folgenden Link, um ein neues Passwort zu setzen:\n\n` +
      `${resetUrl}\n\n` +
      `Der Link ist bis zum Ende des Folgetages gültig und kann nur einmal ` +
      `verwendet werden. Falls du das nicht warst, ignoriere diese E-Mail.\n`;
    const html = baueHtml({
      titel: 'Passwort zurücksetzen',
      absaetze: [
        'du (oder jemand) hat für dein SozioLog-Konto ein neues Passwort angefordert. Klicke auf den Button, um ein neues Passwort zu setzen.',
      ],
      aktion: { text: 'Neues Passwort setzen', url: resetUrl },
      hinweis:
        'Der Link ist bis zum Ende des Folgetages gültig und kann nur einmal verwendet werden. Falls du das nicht warst, ignoriere diese E-Mail.',
    });
    await this.versende(
      email,
      'SozioLog – Passwort zurücksetzen',
      text,
      html,
      `Passwort-Reset an ${email}: ${resetUrl}`,
    );
  }

  /** Generische Benachrichtigungs-Mail (Überprüfung/Korrektur/neuer Vorgang). */
  async sendeBenachrichtigung(
    email: string,
    name: string,
    typ: BenachrichtigungTyp,
    inhalt: string,
  ): Promise<void> {
    const betreff = BENACHRICHTIGUNG_BETREFF[typ];
    const text =
      `Hallo ${name},\n\n${inhalt}\n\n` +
      `Melde dich in SozioLog an, um die Details zu sehen.\n`;
    const html = baueHtml({
      titel: BENACHRICHTIGUNG_TITEL[typ],
      absaetze: [`Hallo ${name},`, inhalt, 'Melde dich in SozioLog an, um die Details zu sehen.'],
    });
    await this.versende(email, betreff, text, html, `${typ} an ${email}`);
  }

  /** Login-Bestätigungscode für die E-Mail-2FA. */
  async sendeLoginCode(email: string, code: string): Promise<void> {
    const text =
      `Hallo,\n\ndein Anmelde-Bestätigungscode für SozioLog lautet:\n\n` +
      `    ${code}\n\n` +
      `Der Code ist 10 Minuten gültig. Falls du dich nicht anmelden wolltest, ` +
      `ignoriere diese E-Mail und ändere sicherheitshalber dein Passwort.\n`;
    const html = baueHtml({
      titel: 'Dein Anmelde-Code',
      absaetze: ['dein Anmelde-Bestätigungscode für SozioLog lautet:'],
      code,
      hinweis:
        'Der Code ist 10 Minuten gültig. Falls du dich nicht anmelden wolltest, ignoriere diese E-Mail und ändere sicherheitshalber dein Passwort.',
    });
    await this.versende(
      email,
      'SozioLog – Anmelde-Code',
      text,
      html,
      `Login-Code an ${email}: ${code}`,
    );
  }

  async sendeEinladung(
    email: string,
    name: string,
    aktivierungsUrl: string,
  ): Promise<void> {
    const text =
      `Hallo ${name},\n\ndu wurdest zu SozioLog eingeladen. Öffne den folgenden ` +
      `Link, um dein Konto zu aktivieren und ein Passwort zu setzen:\n\n` +
      `${aktivierungsUrl}\n\n` +
      `Der Link ist 7 Tage gültig und kann nur einmal verwendet werden.\n`;
    const html = baueHtml({
      titel: 'Einladung zu SozioLog',
      absaetze: [
        `Hallo ${name},`,
        'du wurdest zu SozioLog eingeladen. Klicke auf den Button, um dein Konto zu aktivieren und ein Passwort zu setzen.',
      ],
      aktion: { text: 'Konto aktivieren', url: aktivierungsUrl },
      hinweis: 'Der Link ist 7 Tage gültig und kann nur einmal verwendet werden.',
    });
    await this.versende(
      email,
      'SozioLog – Einladung',
      text,
      html,
      `Einladung an ${email}: ${aktivierungsUrl}`,
    );
  }

  /** Schickt die (festen) Demo-Zugangsdaten an eine anfragende Adresse. */
  async sendeDemoZugang(email: string): Promise<void> {
    const url = this.config.get<string>('DEMO_URL', 'https://demo.soziolog.app');
    const user = this.config.get<string>('DEMO_LOGIN_USER', 'demo-soziologer');
    const pass = this.config.get<string>('DEMO_LOGIN_PASS', 'soziolog-demo1234');
    const text =
      `Hallo,\n\nschön, dass du SozioLog ausprobieren möchtest. Hier deine ` +
      `Zugangsdaten für die Demo:\n\n` +
      `  Adresse:    ${url}\n  Nutzername: ${user}\n  Passwort:   ${pass}\n\n` +
      `Die Demo ist eine echte Instanz mit erfundenen Daten. Probier alles aus – ` +
      `alle Änderungen werden stündlich automatisch zurückgesetzt.\n`;
    const html = baueHtml({
      titel: 'Deine SozioLog-Demo',
      absaetze: [
        'schön, dass du SozioLog ausprobieren möchtest. Hier deine Zugangsdaten für die Demo:',
        `Nutzername: ${user}`,
        `Passwort: ${pass}`,
        'Die Demo ist eine echte Instanz mit erfundenen Daten. Probier alles aus – alle Änderungen werden stündlich automatisch zurückgesetzt.',
      ],
      aktion: { text: 'Zur Demo', url },
    });
    await this.versende(
      email,
      'SozioLog – deine Demo-Zugangsdaten',
      text,
      html,
      `Demo-Zugang an ${email}`,
    );
  }

  /** Interne Benachrichtigung an das Team (z. B. neue Demo-/Pilot-Anfrage). */
  async sendeInterneAnfrage(
    empfaenger: string,
    betreff: string,
    zeilen: string[],
  ): Promise<void> {
    const text = zeilen.join('\n') + '\n';
    const html = baueHtml({ titel: betreff, absaetze: zeilen });
    await this.versende(
      empfaenger,
      `SozioLog – ${betreff}`,
      text,
      html,
      `Interne Anfrage (${betreff}) an ${empfaenger}`,
    );
  }

  /** Bestätigung an eine Person, die die Pilotphase angefragt hat. */
  async sendePilotBestaetigung(email: string, name: string): Promise<void> {
    const text =
      `Hallo ${name},\n\nvielen Dank für dein Interesse an der SozioLog-Pilotphase. ` +
      `Wir haben deine Anfrage erhalten und melden uns innerhalb weniger Tage bei dir, ` +
      `um deine Instanz gemeinsam einzurichten.\n\nViele Grüße\nSamuel Kümmel\n`;
    const html = baueHtml({
      titel: 'Danke für deine Anfrage',
      absaetze: [
        `Hallo ${name},`,
        'vielen Dank für dein Interesse an der SozioLog-Pilotphase. Wir haben deine Anfrage erhalten und melden uns innerhalb weniger Tage bei dir, um deine Instanz gemeinsam einzurichten.',
        'Viele Grüße, Samuel Kümmel',
      ],
    });
    await this.versende(
      email,
      'SozioLog – deine Pilotphase-Anfrage',
      text,
      html,
      `Pilot-Bestätigung an ${email}`,
    );
  }

  /** Schickt einen fertig erzeugten PDF-Export als Mail-Anhang. */
  async sendeExportFertig(
    email: string,
    name: string,
    pdf: Buffer,
    dateiname: string,
  ): Promise<void> {
    const text =
      `Hallo ${name},\n\ndein angeforderter Export ist fertig und hängt dieser E-Mail als ` +
      `PDF an (${dateiname}).\n\nViele Grüße\nSozioLog\n`;
    const html = baueHtml({
      titel: 'Dein Export ist fertig',
      absaetze: [
        `Hallo ${name},`,
        `dein angeforderter Export hängt dieser E-Mail als PDF an (${dateiname}).`,
      ],
    });
    await this.versende(
      email,
      'SozioLog – dein Export ist fertig',
      text,
      html,
      `Export an ${email}: ${dateiname}`,
      [{ filename: dateiname, content: pdf, contentType: 'application/pdf' }],
    );
  }
}
