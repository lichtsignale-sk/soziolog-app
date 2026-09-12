import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { heute, zuDatum } from '@soziolog/shared';
import type { RolleTyp } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RechteService } from '../rechte/rechte.service';

@Injectable()
export class RollenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rechte: RechteService,
  ) {}

  /**
   * Setzt die EINE soziokratische Funktionsrolle einer Person in einer Domäne.
   * Pro (Person, Domäne) gibt es genau eine aktive Funktionsrolle; eine bereits
   * bestehende wird beim Wechsel beendet (Historie bleibt erhalten). „teilhabend"
   * ist keine Funktionsrolle, sondern die Mitgliedschaft ohne Rolle – dafür wird
   * beenden() bzw. hier keine neue Zuweisung genutzt.
   *
   * Voraussetzung: Die Person ist gültiges Mitglied der Domäne.
   */
  async setzen(domaeneId: string, personId: string, rolleTyp: RolleTyp) {
    if (!(await this.rechte.istTeilhabender(personId, domaeneId))) {
      throw new UnprocessableEntityException(
        'Rollen können nur an Mitglieder der Domäne vergeben werden.',
      );
    }

    const tag = zuDatum(heute());
    const gueltig = { OR: [{ gueltigBis: null }, { gueltigBis: { gt: tag } }] };

    // Hat die Person bereits genau diese Rolle, ist nichts zu tun (idempotent).
    const [gleiche, andere] = await Promise.all([
      this.prisma.rollenzuweisung.findFirst({
        where: { personId, domaeneId, rolleTyp, ...gueltig },
        select: { id: true },
      }),
      this.prisma.rollenzuweisung.findMany({
        where: { personId, domaeneId, rolleTyp: { not: rolleTyp }, ...gueltig },
        select: { id: true },
      }),
    ]);
    if (gleiche && andere.length === 0) {
      return gleiche;
    }

    // Genau eine aktive Rolle pro (Person, Domäne): alle anderen zuerst beenden.
    return this.prisma.$transaction(async (tx) => {
      await tx.rollenzuweisung.updateMany({
        where: { personId, domaeneId, rolleTyp: { not: rolleTyp }, ...gueltig },
        data: { gueltigBis: tag },
      });
      if (gleiche) return gleiche;
      return tx.rollenzuweisung.create({
        data: { domaeneId, personId, rolleTyp, gueltigAb: tag },
      });
    });
  }

  /**
   * Setzt die Person in dieser Domäne auf „teilhabend" zurück: beendet alle
   * aktiven Funktionsrollen (kein hartes Löschen). Voraussetzung: Mitgliedschaft.
   */
  async aufTeilhabend(domaeneId: string, personId: string) {
    if (!(await this.rechte.istTeilhabender(personId, domaeneId))) {
      throw new UnprocessableEntityException(
        'Rollen können nur an Mitglieder der Domäne vergeben werden.',
      );
    }
    const tag = zuDatum(heute());
    await this.prisma.rollenzuweisung.updateMany({
      where: {
        personId,
        domaeneId,
        OR: [{ gueltigBis: null }, { gueltigBis: { gt: tag } }],
      },
      data: { gueltigBis: tag },
    });
  }

  /** Beendet eine Rollenzuweisung über gueltigBis (zurück auf „teilhabend"). */
  async beenden(rollenId: string) {
    const r = await this.prisma.rollenzuweisung.findUnique({
      where: { id: rollenId },
    });
    if (!r) throw new NotFoundException('Rollenzuweisung nicht gefunden.');
    if (r.gueltigBis) {
      throw new BadRequestException('Rollenzuweisung ist bereits beendet.');
    }
    return this.prisma.rollenzuweisung.update({
      where: { id: rollenId },
      data: { gueltigBis: zuDatum(heute()) },
    });
  }
}
