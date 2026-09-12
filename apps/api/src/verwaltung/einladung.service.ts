import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { heute, datumPlusTage, zuDatum } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { DbClient } from '../prisma/db-client';

/** Gültigkeitsdauer einer Einladung in Tagen. */
const EINLADUNG_TAGE = 7;

/**
 * Verwaltet Einladungs-Token: Ausstellen (Admin-Anlage, Setup) und Einlösen
 * (öffentliche Kontoaktivierung). Es wird nur der HASH des Tokens gespeichert;
 * der Klartext-Token wird beim Ausstellen zurückgegeben und muss vom Aufrufer
 * verschickt werden. Token werden NIE geloggt.
 */
@Injectable()
export class EinladungService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Stellt für eine Person eine (neue) offene Einladung aus. Da personId unique
   * ist, wird eine bestehende Einladung ersetzt (neuer Token, Ablauf zurückgesetzt).
   * Optionaler tx-Client für die Teilnahme an einer Transaktion (Setup).
   */
  async neuAusstellen(personId: string, db: DbClient = this.prisma): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const laeuftAbAm = zuDatum(datumPlusTage(heute(), EINLADUNG_TAGE));

    await db.einladung.upsert({
      where: { personId },
      create: { personId, tokenHash, laeuftAbAm, status: 'offen' },
      update: { tokenHash, laeuftAbAm, status: 'offen', eingeloestAm: null },
    });

    return token;
  }

  /** Findet eine gültige, offene, nicht abgelaufene Einladung zum Token. */
  private async findeGueltige(token: string) {
    const tokenHash = this.hashToken(token);
    const einladung = await this.prisma.einladung.findFirst({
      where: { tokenHash, status: 'offen', eingeloestAm: null },
      include: { person: { select: { name: true, loginEmail: true } } },
    });
    if (!einladung) return null;
    if (zuDatum(heute()).getTime() > einladung.laeuftAbAm.getTime()) {
      return null;
    }
    return einladung;
  }

  /** Basisdaten der Person zur Anzeige auf der öffentlichen Einlösungsseite. */
  async pruefe(token: string): Promise<{ name: string; loginEmail: string }> {
    const einladung = await this.findeGueltige(token);
    if (!einladung) {
      throw new NotFoundException(
        'Diese Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.',
      );
    }
    return {
      name: einladung.person.name,
      loginEmail: einladung.person.loginEmail,
    };
  }

  /**
   * Löst die Einladung ein: setzt das Passwort (Argon2id), markiert die
   * Einladung als eingelöst. Einmalgebrauch atomar über updateMany erzwungen.
   */
  async aktiviere(token: string, passwort: string): Promise<void> {
    const ungueltig = new BadRequestException(
      'Diese Einladung ist ungültig, abgelaufen oder wurde bereits verwendet.',
    );
    const einladung = await this.findeGueltige(token);
    if (!einladung) throw ungueltig;

    const markiert = await this.prisma.einladung.updateMany({
      where: { id: einladung.id, status: 'offen', eingeloestAm: null },
      data: { status: 'eingeloest', eingeloestAm: zuDatum(heute()) },
    });
    if (markiert.count === 0) throw ungueltig;

    const passwortHash = await argon2.hash(passwort, { type: argon2.argon2id });
    await this.prisma.person.update({
      where: { id: einladung.personId },
      data: { passwortHash, aktiv: true },
    });
  }
}
