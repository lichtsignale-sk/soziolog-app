import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { heute, zuDatum } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GueltigkeitService } from '../gueltigkeit/gueltigkeit.service';
import { BenachrichtigungService } from './benachrichtigung.service';

/** „Gültig": gueltigBis null oder in der Zukunft (frischer Stichtag). */
function gueltigFilter(): { OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }] } {
  return { OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }] };
}

/**
 * Täglicher Lauf: erkennt fällige befristete Beschlüsse, benachrichtigt die
 * Teilhabenden der Domäne (genau EINE Benachrichtigung je Beschluss – idempotent)
 * und setzt die Beschlüsse anschließend auf in_ueberpruefung. „Täglich" ist nur
 * die Ausführungszeit; die Fälligkeit selbst bleibt kalendertagbasiert.
 */
@Injectable()
export class UeberpruefungScheduler {
  private readonly logger = new Logger(UeberpruefungScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gueltigkeit: GueltigkeitService,
    private readonly benachrichtigung: BenachrichtigungService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async taeglicherLauf(): Promise<void> {
    const anzahl = await this.verarbeiteFaellige();
    if (anzahl > 0) {
      this.logger.log(`${anzahl} fällige Überprüfung(en) benachrichtigt.`);
    }
  }

  /**
   * Kernlogik (öffentlich für Tests/Live-Smoke). Gibt die Anzahl neu angelegter
   * Überprüfungs-Benachrichtigungen zurück.
   */
  async verarbeiteFaellige(stichtag: string = heute()): Promise<number> {
    const faellige = await this.gueltigkeit.faelligeUeberpruefungen(stichtag);
    let neue = 0;

    for (const f of faellige) {
      // Idempotenz je Fälligkeits-Zyklus: pro Beschluss UND Frist nur einmal.
      // So kann ein erneut befristeter Beschluss beim nächsten Zyklus (neues
      // ueberpruefungsdatum) wieder benachrichtigen.
      const schon = await this.prisma.benachrichtigung.findFirst({
        where: {
          typ: 'ueberpruefung_faellig',
          betrifftBeschlussId: f.id,
          faelligAm: zuDatum(f.ueberpruefungsdatum),
        },
        select: { id: true },
      });
      if (schon) continue;

      const beschluss = await this.prisma.beschluss.findUnique({
        where: { id: f.id },
        select: { vorschlag: { select: { domaeneId: true } } },
      });
      if (!beschluss) continue;
      const domaeneId = beschluss.vorschlag.domaeneId;

      const mitglieder = await this.prisma.mitgliedschaft.findMany({
        where: { domaeneId, ...gueltigFilter() },
        select: { personId: true },
      });
      const teilhabende = [...new Set(mitglieder.map((m) => m.personId))];

      await this.benachrichtigung.erstelleFuerEmpfaenger(
        {
          typ: 'ueberpruefung_faellig',
          inhalt: `Befristeter Beschluss läuft aus: „${f.titel}" (Frist ${f.ueberpruefungsdatum}). Bitte erneut bestätigen, ersetzen oder beenden.`,
          domaeneId,
          betrifftBeschlussId: f.id,
          faelligAm: f.ueberpruefungsdatum,
        },
        teilhabende,
      );
      neue += 1;
    }

    // Status-Flip (wirkt zusätzlich als natürliche Idempotenz für Folgetage).
    await this.gueltigkeit.markiereFaelligeAlsInUeberpruefung(stichtag);
    return neue;
  }
}
