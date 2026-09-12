import { createServer, type Server, type Socket } from 'net';
import type { ConfigService } from '@nestjs/config';
import { baueTransport, smtpOptionen, tlsErzwungen } from './transport';

/**
 * Ein Postausgang, der KEIN STARTTLS anbietet — genau der Fall, gegen den
 * `requireTLS` schützt. Der Test spricht bewusst echtes SMTP über einen
 * echten Socket: eine Behauptung über nodemailer-Optionen belegt nicht, dass
 * am Ende auch wirklich nichts hinausgeht.
 */
interface FalscherPostausgang {
  port: number;
  /** Alles, was der Client über die Leitung geschickt hat. */
  mitschnitt(): string;
  schliesse(): Promise<void>;
}

function starteSmtpOhneStarttls(): Promise<FalscherPostausgang> {
  const empfangen: string[] = [];
  const verbindungen = new Set<Socket>();

  const server: Server = createServer((socket) => {
    verbindungen.add(socket);
    socket.on('close', () => verbindungen.delete(socket));
    socket.on('error', () => undefined);

    let rest = '';
    let imDatenteil = false;
    socket.write('220 falscher-postausgang.test ESMTP\r\n');

    socket.on('data', (brocken) => {
      empfangen.push(brocken.toString('utf8'));
      rest += brocken.toString('utf8');
      let umbruch: number;
      while ((umbruch = rest.indexOf('\r\n')) !== -1) {
        const zeile = rest.slice(0, umbruch);
        rest = rest.slice(umbruch + 2);

        if (imDatenteil) {
          if (zeile === '.') {
            imDatenteil = false;
            socket.write('250 OK: angenommen\r\n');
          }
          continue;
        }

        const befehl = zeile.slice(0, 4).toUpperCase();
        if (befehl === 'EHLO') {
          // Die entscheidende Zeile: KEIN STARTTLS in den Fähigkeiten.
          socket.write('250-falscher-postausgang.test\r\n250 8BITMIME\r\n');
        } else if (befehl === 'HELO') {
          socket.write('250 falscher-postausgang.test\r\n');
        } else if (befehl === 'STAR') {
          // nodemailer schickt STARTTLS auch dann, wenn es nicht angeboten
          // wurde. Ein Postausgang ohne Verschlüsselung weist das ab — genau
          // dieses „nein" muss den Versand beenden.
          socket.write('502 STARTTLS wird nicht unterstuetzt\r\n');
        } else if (befehl === 'DATA') {
          imDatenteil = true;
          socket.write('354 Weiter, Ende mit <CRLF>.<CRLF>\r\n');
        } else if (befehl === 'QUIT') {
          socket.write('221 Tschuess\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });
  });

  return new Promise((fertig) => {
    server.listen(0, '127.0.0.1', () => {
      const adresse = server.address();
      const port = typeof adresse === 'object' && adresse ? adresse.port : 0;
      fertig({
        port,
        mitschnitt: () => empfangen.join(''),
        schliesse: () =>
          new Promise((zu) => {
            for (const socket of verbindungen) socket.destroy();
            server.close(() => zu());
          }),
      });
    });
  });
}

const MAIL = {
  from: 'SozioLog <noreply@example.com>',
  to: 'opfer@example.com',
  subject: 'SozioLog – Passwort zurücksetzen',
  text: 'Link: https://soziolog.test/passwort-zuruecksetzen?token=GEHEIMES-TOKEN',
};

describe('SMTP-Transport gegen einen Postausgang ohne Verschlüsselung', () => {
  let postausgang: FalscherPostausgang;

  beforeEach(async () => {
    postausgang = await starteSmtpOhneStarttls();
  });

  afterEach(async () => {
    await postausgang.schliesse();
  });

  it('VERSENDET NICHT, wenn die Gegenstelle kein STARTTLS anbietet', async () => {
    const transport = baueTransport(
      { host: '127.0.0.1', port: postausgang.port },
      true,
    );

    await expect(transport.sendMail(MAIL)).rejects.toThrow();

    // Und zwar wirklich nicht: das Kontoübernahme-Token darf die Leitung nie
    // gesehen haben. Ein Abbruch NACH dem DATA-Kommando wäre wertlos.
    expect(postausgang.mitschnitt()).not.toContain('GEHEIMES-TOKEN');
    expect(postausgang.mitschnitt()).not.toContain('DATA');
  }, 15_000);

  it('meldet den Grund, statt still zu scheitern', async () => {
    const transport = baueTransport(
      { host: '127.0.0.1', port: postausgang.port },
      true,
    );
    // Der Fehler muss bis zum Aufrufer durchschlagen (der MailService fängt
    // ihn nicht ab) und erkennbar von der Verschlüsselung handeln.
    const fehler = await transport.sendMail(MAIL).then(
      () => null,
      (f: Error & { code?: string }) => f,
    );
    expect(fehler).not.toBeNull();
    expect(`${fehler?.code ?? ''} ${fehler?.message ?? ''}`).toMatch(
      /TLS|ESECURE|secure/i,
    );
  }, 15_000);

  it('versendet ohne Zwang sehr wohl — der Prüfaufbau ist also gültig', async () => {
    // Gegenprobe: Ohne `requireTLS` nimmt derselbe Postausgang die Mail an.
    // Ohne diese Richtung könnte der Test auch dann grün sein, wenn der
    // falsche Postausgang schlicht kaputt wäre.
    const transport = baueTransport(
      { host: '127.0.0.1', port: postausgang.port },
      false,
    );
    await expect(transport.sendMail(MAIL)).resolves.toBeDefined();
    expect(postausgang.mitschnitt()).toContain('GEHEIMES-TOKEN');
  }, 15_000);
});

describe('smtpOptionen', () => {
  it('erzwingt STARTTLS auf den Klartext-Ports', () => {
    const optionen = smtpOptionen({ host: 'mail.example.com', port: 587 }, true);
    expect(optionen.secure).toBe(false);
    expect(optionen.requireTLS).toBe(true);
  });

  it('spricht auf Port 465 von Anfang an TLS', () => {
    const optionen = smtpOptionen({ host: 'mail.example.com', port: 465 }, true);
    expect(optionen.secure).toBe(true);
  });

  it('prüft das Zertifikat immer — auch mit abgeschaltetem Zwang', () => {
    // `rejectUnauthorized` ist bewusst nirgends erreichbar. Eine Verbindung,
    // die jedes Zertifikat annimmt, sieht nur aus wie Verschlüsselung.
    for (const erzwungen of [true, false]) {
      const optionen = smtpOptionen(
        { host: 'mail.example.com', port: 587 },
        erzwungen,
      );
      expect(optionen.tls?.rejectUnauthorized).toBe(true);
      expect(optionen.tls?.minVersion).toBe('TLSv1.2');
    }
  });

  it('meldet sich nur an, wenn ein Benutzer hinterlegt ist', () => {
    expect(
      smtpOptionen({ host: 'mail.example.com', port: 587 }, true).auth,
    ).toBeUndefined();
    expect(
      smtpOptionen(
        { host: 'mail.example.com', port: 587, user: 'a', passwort: 'b' },
        true,
      ).auth,
    ).toEqual({ user: 'a', pass: 'b' });
  });
});

describe('tlsErzwungen', () => {
  const config = (wert?: string): ConfigService =>
    ({
      get: (_schluessel: string, vorgabe?: string) => wert ?? vorgabe,
    }) as unknown as ConfigService;

  it('erzwingt, solange nicht ausdrücklich abgeschaltet', () => {
    expect(tlsErzwungen(config(undefined))).toBe(true);
    expect(tlsErzwungen(config('1'))).toBe(true);
    expect(tlsErzwungen(config('false'))).toBe(true);
  });

  it('schaltet nur bei der ausdrücklichen 0 ab', () => {
    expect(tlsErzwungen(config('0'))).toBe(false);
  });
});
