import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * DER SMTP-UNTERBAU — bewusst getrennt vom MailService.
 *
 * Die API baut ihren Postausgang aus ZWEI Quellen: den im Setup hinterlegten
 * und verschlüsselt gespeicherten Zugangsdaten (KonfigService) und den
 * `SMTP_*`-Umgebungsvariablen. Beide Wege verschicken dieselben
 * Passwort-Reset-Links. Die Verschlüsselungspflicht steht deshalb an genau
 * EINER Stelle: zwei Abschriften wären zwei Stellen, an denen jemand
 * `requireTLS` vergessen kann, und die zweite fällt niemandem auf.
 */
export interface SmtpZugang {
  host: string;
  port: number;
  user?: string;
  passwort?: string;
}

/**
 * Bricht der Versand ab, wenn die Gegenstelle keine Verschlüsselung anbietet?
 *
 * Vorgabe ist „ja". Nur der ausdrückliche Wert `0` schaltet ab, und das auch
 * nur außerhalb von Produktion — dort bricht `pruefeTlsPflicht` schon den
 * Start ab.
 */
export function tlsErzwungen(config: ConfigService): boolean {
  return config.get<string>('SMTP_TLS_ERZWINGEN', '1') !== '0';
}

/**
 * Baut die nodemailer-Optionen für einen Postausgang.
 *
 * `secure` richtet sich nach dem Port: 465 spricht vom ersten Byte an TLS
 * (SMTPS), 587 und 25 beginnen im Klartext und heben per STARTTLS ab.
 * `requireTLS` lässt den Versand abbrechen, wenn die Gegenstelle kein STARTTLS
 * anbietet — sonst genügte es, STARTTLS aus der EHLO-Antwort zu streichen, und
 * nodemailer verschickte die Reset-Links im Klartext.
 *
 * `rejectUnauthorized` steht fest auf `true` und ist bewusst NICHT über eine
 * Umgebungsvariable erreichbar: eine Verbindung, die jedes Zertifikat annimmt,
 * schützt gegen Mitlesen genauso wenig wie gar keine Verschlüsselung — sie
 * sieht nur so aus, als täte sie es.
 */
export function smtpOptionen(
  zugang: SmtpZugang,
  erzwungen: boolean,
): SMTPTransport.Options {
  const implizitesTls = zugang.port === 465;
  return {
    host: zugang.host,
    port: zugang.port,
    secure: implizitesTls,
    requireTLS: erzwungen,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    auth: zugang.user
      ? { user: zugang.user, pass: zugang.passwort }
      : undefined,
  };
}

/** Erzeugt den Transporter zu einem Postausgang. */
export function baueTransport(
  zugang: SmtpZugang,
  erzwungen: boolean,
): nodemailer.Transporter {
  return nodemailer.createTransport(smtpOptionen(zugang, erzwungen));
}
