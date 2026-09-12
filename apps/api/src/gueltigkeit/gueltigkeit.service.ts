import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Beschluss } from '@prisma/client';
import {
  heute,
  zuDatum,
  datumStringAusDate,
  giltAmStichtag,
} from '@soziolog/shared';
import type {
  DomaeneStandDTO,
  StandBeschlussDTO,
  GesamtLogDomaene,
  FaelligeUeberpruefungDTO,
  Befristung,
  GueltigkeitStatus,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { pruefeBefristung } from './befristung';

/** Beschluss mit Vorschlag/Domäne für die Ausgabe. */
type BeschlussMitKontext = Beschluss & {
  vorschlag: { id: string; titel: string; inhalt: string; domaeneId: string; domaene: { name: string } };
};

const MIT_KONTEXT = {
  vorschlag: {
    select: { id: true, titel: true, inhalt: true, domaeneId: true, domaene: { select: { name: true } } },
  },
} satisfies Prisma.BeschlussInclude;

@Injectable()
export class GueltigkeitService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verbindliche Grenzlogik der Engine – delegiert an die eine gemeinsame
   * Definition aus @soziolog/shared (dieselbe Funktion nutzt der Gantt im
   * Frontend, damit die Stichtag-Hervorhebung nie divergiert).
   */
  giltAmStichtag(
    gueltigAb: string,
    gueltigBis: string | null,
    stichtag: string,
  ): boolean {
    return giltAmStichtag(gueltigAb, gueltigBis, stichtag);
  }

  /** Prisma-where für „gilt am Stichtag T" (dieselbe Semantik auf DATE-Ebene). */
  private giltWhere(stichtag: string): Prisma.BeschlussWhereInput {
    const t = zuDatum(stichtag);
    return {
      gueltigAb: { lte: t },
      OR: [{ gueltigBis: null }, { gueltigBis: { gt: t } }],
    };
  }

  private zuStandDTO(b: BeschlussMitKontext): StandBeschlussDTO {
    return {
      id: b.id,
      vorschlagId: b.vorschlag.id,
      titel: b.vorschlag.titel,
      inhalt: b.inhalt,
      gueltigAb: datumStringAusDate(b.gueltigAb),
      gueltigBis: b.gueltigBis ? datumStringAusDate(b.gueltigBis) : null,
      gueltigkeitStatus: b.gueltigkeitStatus as GueltigkeitStatus,
      befristung: b.befristung as Befristung,
      ueberpruefungsdatum: b.ueberpruefungsdatum
        ? datumStringAusDate(b.ueberpruefungsdatum)
        : null,
      erfasstVonLabel: `Logbuchführer ${b.vorschlag.domaene.name}`,
    };
  }

  /** Stand einer Domäne (Domäne) zum Stichtag (default heute). */
  async standFuerDomaene(
    domaeneId: string,
    stichtag: string = heute(),
  ): Promise<DomaeneStandDTO> {
    const domaene = await this.prisma.domaene.findUnique({
      where: { id: domaeneId },
      select: { name: true },
    });
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');

    const beschluesse = await this.prisma.beschluss.findMany({
      where: { vorschlag: { domaeneId }, ...this.giltWhere(stichtag) },
      include: MIT_KONTEXT,
      orderBy: { gueltigAb: 'asc' },
    });
    return {
      domaeneId,
      domaeneName: domaene.name,
      beschluesse: beschluesse.map((b) => this.zuStandDTO(b)),
    };
  }

  /** Stand über ALLE Domänen zum Stichtag, gruppiert nach Domäne. */
  async standAlle(stichtag: string = heute()): Promise<DomaeneStandDTO[]> {
    const beschluesse = await this.prisma.beschluss.findMany({
      where: this.giltWhere(stichtag),
      include: MIT_KONTEXT,
      orderBy: { gueltigAb: 'asc' },
    });
    const proDomaene = new Map<string, DomaeneStandDTO>();
    for (const b of beschluesse) {
      const k = b.vorschlag.domaeneId;
      if (!proDomaene.has(k)) {
        proDomaene.set(k, {
          domaeneId: k,
          domaeneName: b.vorschlag.domaene.name,
          beschluesse: [],
        });
      }
      proDomaene.get(k)!.beschluesse.push(this.zuStandDTO(b));
    }
    return [...proDomaene.values()];
  }

  /**
   * Gantt-Daten: pro Domäne (a) Beschluss-Spannen, deren Gültigkeit das Fenster
   * [von,bis] schneidet, und (b) offene Vorschläge (ohne Beschluss) als Punkte.
   */
  async gesamtLog(von: string, bis: string): Promise<GesamtLogDomaene[]> {
    const vonD = zuDatum(von);
    const bisD = zuDatum(bis);

    const [beschluesse, offene] = await Promise.all([
      this.prisma.beschluss.findMany({
        where: {
          gueltigAb: { lte: bisD },
          OR: [{ gueltigBis: null }, { gueltigBis: { gt: vonD } }],
        },
        include: MIT_KONTEXT,
        orderBy: { gueltigAb: 'asc' },
      }),
      this.prisma.vorschlag.findMany({
        where: { status: 'offen', beschluss: null, datum: { gte: vonD, lte: bisD } },
        select: {
          id: true,
          titel: true,
          inhalt: true,
          datum: true,
          domaeneId: true,
          domaene: { select: { name: true } },
        },
        orderBy: { datum: 'asc' },
      }),
    ]);

    const proDomaene = new Map<string, GesamtLogDomaene>();
    const hole = (domaeneId: string, domaeneName: string): GesamtLogDomaene => {
      if (!proDomaene.has(domaeneId)) {
        proDomaene.set(domaeneId, {
          domaeneId,
          domaeneName,
          spannen: [],
          offeneVorschlaege: [],
        });
      }
      return proDomaene.get(domaeneId)!;
    };

    for (const b of beschluesse) {
      hole(b.vorschlag.domaeneId, b.vorschlag.domaene.name).spannen.push({
        id: b.id,
        vorschlagId: b.vorschlag.id,
        titel: b.vorschlag.titel,
        vorschlagInhalt: b.vorschlag.inhalt,
        beschlussInhalt: b.inhalt,
        gueltigAb: datumStringAusDate(b.gueltigAb),
        gueltigBis: b.gueltigBis ? datumStringAusDate(b.gueltigBis) : null,
        gueltigkeitStatus: b.gueltigkeitStatus as GueltigkeitStatus,
        befristung: b.befristung as Befristung,
        ueberpruefungsdatum: b.ueberpruefungsdatum
          ? datumStringAusDate(b.ueberpruefungsdatum)
          : null,
        ersetztBeschlussId: b.ersetztBeschlussId,
      });
    }
    for (const v of offene) {
      hole(v.domaeneId, v.domaene.name).offeneVorschlaege.push({
        id: v.id,
        titel: v.titel,
        vorschlagInhalt: v.inhalt,
        datum: datumStringAusDate(v.datum),
      });
    }
    return [...proDomaene.values()];
  }

  /** Prisma-where für fällige befristete Beschlüsse. */
  private faelligWhere(stichtag: string): Prisma.BeschlussWhereInput {
    return {
      befristung: 'befristet',
      gueltigkeitStatus: 'gueltig',
      ueberpruefungsdatum: { lte: zuDatum(stichtag) },
    };
  }

  /** Erkennt fällige Überprüfungen (nur lesen, kein Benachrichtigen). */
  async faelligeUeberpruefungen(
    stichtag: string = heute(),
  ): Promise<FaelligeUeberpruefungDTO[]> {
    const beschluesse = await this.prisma.beschluss.findMany({
      where: this.faelligWhere(stichtag),
      include: MIT_KONTEXT,
      orderBy: { ueberpruefungsdatum: 'asc' },
    });
    return beschluesse.map((b) => ({
      id: b.id,
      vorschlagId: b.vorschlag.id,
      titel: b.vorschlag.titel,
      gueltigAb: datumStringAusDate(b.gueltigAb),
      ueberpruefungsdatum: datumStringAusDate(b.ueberpruefungsdatum!),
    }));
  }

  /**
   * Markiert fällige Beschlüsse als in_ueberpruefung. Wird in Teil 4 vom
   * Scheduler aufgerufen; hier ohne Endpunkt. Gibt die Anzahl zurück.
   */
  async markiereFaelligeAlsInUeberpruefung(
    stichtag: string = heute(),
  ): Promise<number> {
    const { count } = await this.prisma.beschluss.updateMany({
      where: this.faelligWhere(stichtag),
      data: { gueltigkeitStatus: 'in_ueberpruefung' },
    });
    return count;
  }

  /**
   * Beendet einen Beschluss ohne Nachfolger. Nur erlaubt, wenn aktuell gueltig
   * oder in_ueberpruefung (sonst 409).
   */
  async beendeBeschluss(beschlussId: string): Promise<void> {
    const b = await this.prisma.beschluss.findUnique({ where: { id: beschlussId } });
    if (!b) throw new NotFoundException('Beschluss nicht gefunden.');
    if (b.gueltigkeitStatus !== 'gueltig' && b.gueltigkeitStatus !== 'in_ueberpruefung') {
      throw new ConflictException(
        'Nur gültige oder in Überprüfung befindliche Beschlüsse können beendet werden.',
      );
    }
    await this.prisma.beschluss.update({
      where: { id: beschlussId },
      data: { gueltigkeitStatus: 'beendet', gueltigBis: zuDatum(heute()) },
    });
    await this.entferneFaelligBenachrichtigung(beschlussId);
  }

  /**
   * Bestätigt einen befristeten Beschluss am Fristende erneut – ES BLEIBT
   * DERSELBE Beschluss (durchgehende Linie im Gesamt-Log): Status zurück auf
   * gueltig, neue Befristung/neues Überprüfungsdatum (oder entfristet).
   * Nur erlaubt, wenn aktuell gueltig oder in_ueberpruefung (sonst 409).
   */
  async bestaetigeBeschluss(
    beschlussId: string,
    eingabe: { befristung: Befristung; ueberpruefungsdatum?: string | null },
  ): Promise<void> {
    const b = await this.prisma.beschluss.findUnique({ where: { id: beschlussId } });
    if (!b) throw new NotFoundException('Beschluss nicht gefunden.');
    if (b.gueltigkeitStatus !== 'gueltig' && b.gueltigkeitStatus !== 'in_ueberpruefung') {
      throw new ConflictException(
        'Nur gültige oder in Überprüfung befindliche Beschlüsse können bestätigt werden.',
      );
    }
    const ueberpruefungsdatum = pruefeBefristung(eingabe);
    await this.prisma.beschluss.update({
      where: { id: beschlussId },
      data: {
        gueltigkeitStatus: 'gueltig',
        befristung: eingabe.befristung,
        ueberpruefungsdatum,
      },
    });
    await this.entferneFaelligBenachrichtigung(beschlussId);
  }

  /**
   * Entfernt die erledigten „Überprüfung fällig"-Benachrichtigungen eines
   * Beschlusses (Empfänge cascaden). Inline gehalten, um keine Modul-Abhängigkeit
   * zum BenachrichtigungService zu erzeugen (der bereits GueltigkeitService nutzt).
   */
  private async entferneFaelligBenachrichtigung(beschlussId: string): Promise<void> {
    await this.prisma.benachrichtigung.deleteMany({
      where: { typ: 'ueberpruefung_faellig', betrifftBeschlussId: beschlussId },
    });
  }
}
