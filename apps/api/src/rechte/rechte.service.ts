import { Injectable } from '@nestjs/common';
import { heute, zuDatum } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { SitzungsPerson } from '../common/guards/sitzung.guard';

/**
 * Strukturelles Filter-Fragment für „gültig" – passt sowohl auf
 * Rollenzuweisung als auch Mitgliedschaft (beide haben gueltigBis).
 */
type GueltigFilter = {
  OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }];
};

/**
 * Zentrale, überall wiederverwendbare Rechteprüfung.
 *
 * Rollenmodell:
 *  - Teilhabender  = gültige Mitgliedschaft in einem Domäne
 *  - Protokollführer = gültige Logbuchführer-Rolle in DIESEM Domäne
 *  - Admin         = Person.istAdmin (organisationsweit)
 *
 * Lesen ist unbeschränkt: jede angemeldete, aktive Person darf ALLES in ALLEN
 * Domänen lesen – dafür gibt es bewusst keine Domäne-Prüfmethode.
 */
@Injectable()
export class RechteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * „Gültig" an EINER Stelle definiert: gueltigBis ist null ODER liegt in der
   * Zukunft (> heute). Eine beendete Zuweisung (gueltigBis <= heute) zählt nicht
   * mehr. So kann ein Beenden per gueltigBis=heute sofort wirken.
   */
  private gueltigWhere(): GueltigFilter {
    return {
      OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }],
    };
  }

  istAngemeldetUndAktiv(person: SitzungsPerson | null | undefined): boolean {
    return !!person;
  }

  istAdmin(person: SitzungsPerson | null | undefined): boolean {
    return !!person?.istAdmin;
  }

  /** Gültige Logbuchführer-Rolle dieser Person in diesem Domäne? */
  async istProtokollfuehrer(personId: string, domaeneId: string): Promise<boolean> {
    const treffer = await this.prisma.rollenzuweisung.findFirst({
      where: {
        personId,
        domaeneId,
        rolleTyp: 'logbuchfuehrer',
        ...this.gueltigWhere(),
      },
      select: { id: true },
    });
    return treffer !== null;
  }

  /** Gültige Mitgliedschaft dieser Person in diesem Domäne? */
  async istTeilhabender(personId: string, domaeneId: string): Promise<boolean> {
    const treffer = await this.prisma.mitgliedschaft.findFirst({
      where: { personId, domaeneId, ...this.gueltigWhere() },
      select: { id: true },
    });
    return treffer !== null;
  }

  /**
   * Hat die Person eine weitere gültige Mitgliedschaft außer der angegebenen?
   * Grundlage der Mindestens-Teilhabender-Invariante beim Beenden.
   */
  async hatAndereGueltigeMitgliedschaft(
    personId: string,
    ausserMitgliedschaftId: string,
  ): Promise<boolean> {
    const treffer = await this.prisma.mitgliedschaft.findFirst({
      where: {
        personId,
        id: { not: ausserMitgliedschaftId },
        ...this.gueltigWhere(),
      },
      select: { id: true },
    });
    return treffer !== null;
  }

  /**
   * Hat die Person eine gültige Mitgliedschaft in einem ANDEREN Domäne als dem
   * angegebenen? Grundlage der Verwaisungsprüfung bei der Domänen-Auflösung: wäre
   * die Antwort nein, würde die Person durch die Auflösung verwaisen.
   */
  async hatMitgliedschaftInAnderemDomaene(
    personId: string,
    ausserDomaeneId: string,
  ): Promise<boolean> {
    const treffer = await this.prisma.mitgliedschaft.findFirst({
      where: {
        personId,
        domaeneId: { not: ausserDomaeneId },
        ...this.gueltigWhere(),
      },
      select: { id: true },
    });
    return treffer !== null;
  }
}
