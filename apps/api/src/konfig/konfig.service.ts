import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { heute, zuDatum } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Prisma-Client oder Transaktions-Client (für Teilnahme an einer Transaktion). */
type DbClient = PrismaService | Prisma.TransactionClient | PrismaClient;

/** SMTP-Konfigurationsschlüssel in der Systemkonfiguration. */
export const SMTP_SCHLUESSEL = {
  host: 'smtp_host',
  port: 'smtp_port',
  user: 'smtp_user',
  passwort: 'smtp_passwort',
  absender: 'smtp_absender',
} as const;

export interface SmtpKonfig {
  host: string;
  port: number;
  user?: string;
  passwort?: string;
  absender: string;
}

/**
 * Liest/schreibt anwendungsseitig verschlüsselte Konfigurationswerte
 * (z. B. SMTP-Zugangsdaten). Verschlüsselung: AES-256-GCM mit einem aus
 * CONFIG_KEY (Fallback SESSION_SECRET) abgeleiteten Schlüssel. Klartextwerte –
 * insbesondere das SMTP-Passwort – werden NIE geloggt.
 */
@Injectable()
export class KonfigService {
  private readonly logger = new Logger(KonfigService.name);
  private readonly schluessel: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const geheim =
      config.get<string>('CONFIG_KEY') ??
      config.get<string>('SESSION_SECRET') ??
      'unsicherer-entwicklungs-schluessel';
    // Fester Salt: der Schlüssel muss über Neustarts hinweg stabil sein, um
    // gespeicherte Werte weiter entschlüsseln zu können.
    this.schluessel = scryptSync(geheim, 'soziolog-konfig-salt', 32);
  }

  private verschluessele(klartext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.schluessel, iv);
    const ct = Buffer.concat([
      cipher.update(klartext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  private entschluessele(gespeichert: string): string {
    const [ivB64, tagB64, ctB64] = gespeichert.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.schluessel, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      'utf8',
    );
  }

  /**
   * Speichert einen Wert verschlüsselt. Ein optionaler Transaktions-Client
   * erlaubt die Teilnahme an einer umschließenden Transaktion (z. B. Setup).
   */
  async setze(
    schluessel: string,
    klartext: string,
    db: DbClient = this.prisma,
  ): Promise<void> {
    const wertVerschluesselt = this.verschluessele(klartext);
    const aktualisiertAm = zuDatum(heute());
    await db.systemkonfiguration.upsert({
      where: { schluessel },
      create: { schluessel, wertVerschluesselt, aktualisiertAm },
      update: { wertVerschluesselt, aktualisiertAm },
    });
  }

  /** Liest und entschlüsselt einen Wert oder null. */
  async hole(schluessel: string): Promise<string | null> {
    const eintrag = await this.prisma.systemkonfiguration.findUnique({
      where: { schluessel },
    });
    if (!eintrag) return null;
    try {
      return this.entschluessele(eintrag.wertVerschluesselt);
    } catch {
      this.logger.error(
        `Konfigurationswert "${schluessel}" konnte nicht entschlüsselt werden (falscher CONFIG_KEY?).`,
      );
      return null;
    }
  }

  /** Liest die gespeicherte SMTP-Konfiguration oder null, wenn nicht gesetzt. */
  async holeSmtp(): Promise<SmtpKonfig | null> {
    const host = await this.hole(SMTP_SCHLUESSEL.host);
    const absender = await this.hole(SMTP_SCHLUESSEL.absender);
    if (!host || !absender) return null;
    const portRoh = await this.hole(SMTP_SCHLUESSEL.port);
    return {
      host,
      port: portRoh ? Number(portRoh) : 587,
      user: (await this.hole(SMTP_SCHLUESSEL.user)) ?? undefined,
      passwort: (await this.hole(SMTP_SCHLUESSEL.passwort)) ?? undefined,
      absender,
    };
  }

  /** Speichert eine komplette SMTP-Konfiguration (verschlüsselt), optional in tx. */
  async setzeSmtp(smtp: SmtpKonfig, db: DbClient = this.prisma): Promise<void> {
    await this.setze(SMTP_SCHLUESSEL.host, smtp.host, db);
    await this.setze(SMTP_SCHLUESSEL.port, String(smtp.port), db);
    await this.setze(SMTP_SCHLUESSEL.user, smtp.user ?? '', db);
    await this.setze(SMTP_SCHLUESSEL.passwort, smtp.passwort ?? '', db);
    await this.setze(SMTP_SCHLUESSEL.absender, smtp.absender, db);
  }
}
