import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { heute, zuDatum } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RechteService } from '../rechte/rechte.service';

@Injectable()
export class MitgliedschaftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rechte: RechteService,
  ) {}

  /** Fügt eine Person einem Domäne als Mitglied (Teilhabender) hinzu. */
  async hinzufuegen(domaeneId: string, personId: string) {
    const [domaene, person] = await Promise.all([
      this.prisma.domaene.findUnique({ where: { id: domaeneId }, select: { id: true } }),
      this.prisma.person.findUnique({ where: { id: personId }, select: { id: true } }),
    ]);
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');
    if (!person) throw new NotFoundException('Person nicht gefunden.');

    if (await this.rechte.istTeilhabender(personId, domaeneId)) {
      throw new ConflictException('Person ist bereits Mitglied dieser Domäne.');
    }

    return this.prisma.mitgliedschaft.create({
      data: { domaeneId, personId, gueltigAb: zuDatum(heute()) },
    });
  }

  /** Beendet die gültige Mitgliedschaft einer Person in einer Domäne (per
   *  Domäne+Person, für die Rollen-Verwaltung). */
  async beendenFuerPerson(domaeneId: string, personId: string) {
    const m = await this.prisma.mitgliedschaft.findFirst({
      where: { domaeneId, personId, gueltigBis: null },
      select: { id: true },
    });
    if (!m) throw new NotFoundException('Mitgliedschaft nicht gefunden.');
    await this.beenden(m.id);
  }

  /**
   * Beendet eine Mitgliedschaft über gueltigBis (kein hartes Löschen). Blockt,
   * wenn es die letzte gültige Mitgliedschaft der Person wäre (Mindestens-
   * Teilhabender-Invariante). Beendet zugleich die noch gültigen Rollen der
   * Person in diesem Domäne (keine Rolle ohne Mitgliedschaft).
   */
  async beenden(mitgliedschaftId: string) {
    const m = await this.prisma.mitgliedschaft.findUnique({
      where: { id: mitgliedschaftId },
    });
    if (!m) throw new NotFoundException('Mitgliedschaft nicht gefunden.');
    if (m.gueltigBis) {
      throw new BadRequestException('Mitgliedschaft ist bereits beendet.');
    }

    const hatAndere = await this.rechte.hatAndereGueltigeMitgliedschaft(
      m.personId,
      mitgliedschaftId,
    );
    if (!hatAndere) {
      throw new UnprocessableEntityException(
        'Letzte Mitgliedschaft: Die Person würde ohne Domäne dastehen. Zuerst in einer anderen Domäne aufnehmen.',
      );
    }

    const tag = zuDatum(heute());
    await this.prisma.$transaction([
      this.prisma.mitgliedschaft.update({
        where: { id: mitgliedschaftId },
        data: { gueltigBis: tag },
      }),
      // Noch gültige Rollen der Person in diesem Domäne mitbeenden.
      this.prisma.rollenzuweisung.updateMany({
        where: {
          personId: m.personId,
          domaeneId: m.domaeneId,
          OR: [{ gueltigBis: null }, { gueltigBis: { gt: tag } }],
        },
        data: { gueltigBis: tag },
      }),
    ]);
  }
}
