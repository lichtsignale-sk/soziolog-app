import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  heute,
  zuDatum,
  datumAusString,
  datumStringAusDate,
  istKorrigierbar,
} from '@soziolog/shared';
import type {
  KorrekturZielTyp,
  KorrekturStatus,
  KorrekturantragDTO,
  AenderungslogEintragDTO,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BenachrichtigungService } from '../benachrichtigung/benachrichtigung.service';

/** Auflösung eines Zieleintrags: Domaenebezug, Vorschlag-Kontext, Rohdatensatz. */
export interface ZielKontext {
  domaeneId: string;
  domaeneName: string;
  vorschlagId: string;
  vorschlagTitel: string;
  record: Record<string, unknown>;
}

@Injectable()
export class KorrekturService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly benachrichtigung: BenachrichtigungService,
  ) {}

  private readonly domaeneInclude = {
    domaene: { select: { id: true, name: true } },
  };

  /**
   * Löst einen Zieleintrag (per zielTyp/zielId) zu seinem Domäne und
   * Vorschlag-Kontext auf. Zentrale Stelle für den Domaenebezug (der Guard und
   * die Rollen-Label bauen darauf auf). Wirft 404, wenn das Ziel fehlt.
   */
  async zielKontext(
    zielTyp: KorrekturZielTyp,
    zielId: string,
  ): Promise<ZielKontext> {
    if (zielTyp === 'vorschlag') {
      const v = await this.prisma.vorschlag.findUnique({
        where: { id: zielId },
        include: this.domaeneInclude,
      });
      if (!v) throw new NotFoundException('Zieleintrag nicht gefunden.');
      return {
        domaeneId: v.domaeneId,
        domaeneName: v.domaene.name,
        vorschlagId: v.id,
        vorschlagTitel: v.titel,
        record: v as unknown as Record<string, unknown>,
      };
    }

    const include = {
      vorschlag: { include: this.domaeneInclude },
    } as const;

    const eintrag =
      zielTyp === 'bedenken'
        ? await this.prisma.bedenken.findUnique({ where: { id: zielId }, include })
        : zielTyp === 'einwand'
          ? await this.prisma.einwand.findUnique({ where: { id: zielId }, include })
          : await this.prisma.beschluss.findUnique({ where: { id: zielId }, include });

    if (!eintrag) throw new NotFoundException('Zieleintrag nicht gefunden.');
    const v = eintrag.vorschlag;
    return {
      domaeneId: v.domaeneId,
      domaeneName: v.domaene.name,
      vorschlagId: v.id,
      vorschlagTitel: v.titel,
      record: eintrag as unknown as Record<string, unknown>,
    };
  }

  /** Schreibt EIN whitelisted Feld in das Zielmodell (innerhalb einer Transaktion). */
  private async schreibeZielfeld(
    tx: Prisma.TransactionClient,
    zielTyp: KorrekturZielTyp,
    zielId: string,
    feld: string,
    wert: string,
  ): Promise<void> {
    const data = { [feld]: wert } as Record<string, string>;
    switch (zielTyp) {
      case 'vorschlag':
        await tx.vorschlag.update({ where: { id: zielId }, data });
        break;
      case 'bedenken':
        await tx.bedenken.update({ where: { id: zielId }, data });
        break;
      case 'einwand':
        await tx.einwand.update({ where: { id: zielId }, data });
        break;
      case 'beschluss':
        if (feld === 'ueberpruefungsdatum') {
          // Ein Feld deckt Befristung + Frist ab: leer ⇒ unbefristet, Datum ⇒
          // befristet bis zu diesem Tag.
          const leer = wert.trim() === '';
          await tx.beschluss.update({
            where: { id: zielId },
            data: leer
              ? { befristung: 'unbefristet', ueberpruefungsdatum: null }
              : {
                  befristung: 'befristet',
                  ueberpruefungsdatum: zuDatum(datumAusString(wert)),
                },
          });
        } else {
          await tx.beschluss.update({ where: { id: zielId }, data });
        }
        break;
    }
  }

  /**
   * Legt eine Benachrichtigung an (je Empfang) und versendet – nach der
   * Präferenz benachrichtigungenAktiv – eine E-Mail. Delegiert an den zentralen
   * BenachrichtigungService (dieselbe Regel wie bei Überprüfungen).
   */
  private async benachrichtige(
    typ: 'korrektur_beantragt' | 'korrektur_bestaetigt' | 'korrektur_abgelehnt',
    korrekturId: string,
    domaeneId: string,
    inhalt: string,
    empfaengerIds: string[],
  ): Promise<void> {
    await this.benachrichtigung.erstelleFuerEmpfaenger(
      { typ, betrifftKorrekturId: korrekturId, domaeneId: domaeneId || null, inhalt },
      empfaengerIds,
    );
  }

  /**
   * Stellt einen Korrekturantrag. Feld wird hart gegen die Whitelist geprüft
   * (Sicherheitsgrenze), alterInhalt aus dem aktuellen Wert übernommen. Danach
   * werden alle aktiven Admins der Organisation benachrichtigt.
   */
  async antragStellen(
    personId: string,
    organisationId: string,
    eingabe: {
      zielTyp: KorrekturZielTyp;
      zielId: string;
      feld: string;
      neuerInhalt: string;
      begruendung?: string;
    },
  ): Promise<{ id: string }> {
    const { zielTyp, zielId, feld, neuerInhalt, begruendung } = eingabe;
    if (!istKorrigierbar(zielTyp, feld)) {
      throw new UnprocessableEntityException(
        `Das Feld „${feld}" ist bei ${zielTyp} nicht korrigierbar.`,
      );
    }

    const ziel = await this.zielKontext(zielTyp, zielId);
    // Datumsfeld (Befristung): als YYYY-MM-DD bzw. leer (unbefristet) festhalten.
    const rohWert = ziel.record[feld];
    const alterInhalt =
      zielTyp === 'beschluss' && feld === 'ueberpruefungsdatum'
        ? rohWert instanceof Date
          ? datumStringAusDate(rohWert)
          : ''
        : String(rohWert ?? '');

    // Antragsteller-Name denormalisiert speichern (wird namentlich angezeigt).
    const antragsteller = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, displayName: true },
    });

    const antrag = await this.prisma.korrekturantrag.create({
      data: {
        zielTyp,
        zielId,
        feld,
        alterInhalt,
        neuerInhalt,
        begruendung: begruendung ?? null,
        beantragtVonId: personId,
        beantragtVonName: antragsteller?.name ?? '—',
        beantragtVonRolle: 'Logbuchführend',
        beantragtVonDomaene: ziel.domaeneName,
        status: 'offen',
        beantragtAm: zuDatum(heute()),
      },
    });

    const admins = await this.prisma.person.findMany({
      where: { organisationId, istAdmin: true, aktiv: true },
      select: { id: true },
    });
    await this.benachrichtige(
      'korrektur_beantragt',
      antrag.id,
      ziel.domaeneId,
      `Neuer Korrekturantrag zu „${ziel.vorschlagTitel}" (Feld ${feld}).`,
      admins.map((a) => a.id),
    );

    return { id: antrag.id };
  }

  /**
   * Bestätigt einen Antrag. Der Statuswechsel offen→bestaetigt erfolgt als
   * bedingtes updateMany (atomar) UND die Feldschreibung in EINER Transaktion.
   * Zwei gleichzeitige Bestätigungen: nur die erste wirkt, die zweite -> 409.
   */
  async bestaetigen(korrekturId: string, adminId: string): Promise<void> {
    const vorhanden = await this.prisma.korrekturantrag.findUnique({
      where: { id: korrekturId },
      select: { id: true },
    });
    if (!vorhanden) throw new NotFoundException('Korrekturantrag nicht gefunden.');

    const antrag = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.korrekturantrag.updateMany({
        where: { id: korrekturId, status: 'offen' },
        data: {
          status: 'bestaetigt',
          bestaetigtVonId: adminId,
          entschiedenAm: zuDatum(heute()),
        },
      });
      if (claim.count === 0) {
        throw new ConflictException('Antrag wurde bereits bearbeitet.');
      }
      const k = await tx.korrekturantrag.findUniqueOrThrow({
        where: { id: korrekturId },
      });
      const zielTyp = k.zielTyp as KorrekturZielTyp;
      // Defensiv: nur whitelisted Felder werden je geschrieben.
      if (!istKorrigierbar(zielTyp, k.feld)) {
        throw new UnprocessableEntityException(
          `Das Feld „${k.feld}" ist nicht korrigierbar.`,
        );
      }
      await this.schreibeZielfeld(tx, zielTyp, k.zielId, k.feld, k.neuerInhalt);
      return k;
    });

    // „Zu bestätigen"-Benachrichtigungen sind erledigt → aus allen Popovers entfernen.
    await this.benachrichtigung.entferneKorrekturBeantragt(antrag.id);

    const ziel = await this.zielKontext(
      antrag.zielTyp as KorrekturZielTyp,
      antrag.zielId,
    ).catch(() => null);
    await this.benachrichtige(
      'korrektur_bestaetigt',
      antrag.id,
      ziel?.domaeneId ?? '',
      `Deine Korrektur (Feld ${antrag.feld}) wurde bestätigt.`,
      antrag.beantragtVonId ? [antrag.beantragtVonId] : [],
    );
  }

  /** Lehnt einen Antrag atomar ab (keine Feldschreibung). Begründung Pflicht. */
  async ablehnen(
    korrekturId: string,
    adminId: string,
    grund: string,
  ): Promise<void> {
    const vorhanden = await this.prisma.korrekturantrag.findUnique({
      where: { id: korrekturId },
      select: { id: true },
    });
    if (!vorhanden) throw new NotFoundException('Korrekturantrag nicht gefunden.');

    const claim = await this.prisma.korrekturantrag.updateMany({
      where: { id: korrekturId, status: 'offen' },
      data: {
        status: 'abgelehnt',
        ablehnungsgrund: grund,
        bestaetigtVonId: adminId,
        entschiedenAm: zuDatum(heute()),
      },
    });
    if (claim.count === 0) {
      throw new ConflictException('Antrag wurde bereits bearbeitet.');
    }

    const antrag = await this.prisma.korrekturantrag.findUniqueOrThrow({
      where: { id: korrekturId },
    });
    // „Zu bestätigen"-Benachrichtigungen sind erledigt → aus allen Popovers entfernen.
    await this.benachrichtigung.entferneKorrekturBeantragt(antrag.id);

    const ziel = await this.zielKontext(
      antrag.zielTyp as KorrekturZielTyp,
      antrag.zielId,
    ).catch(() => null);
    await this.benachrichtige(
      'korrektur_abgelehnt',
      antrag.id,
      ziel?.domaeneId ?? '',
      `Deine Korrektur (Feld ${antrag.feld}) wurde abgelehnt.`,
      antrag.beantragtVonId ? [antrag.beantragtVonId] : [],
    );
  }

  /** Wie zielKontext, aber null statt 404 – für Listen, die ein fehlendes Ziel
   *  einzeln überspringen sollen (ein Waise darf nie die ganze Liste kippen). */
  private async zielKontextOderNull(
    zielTyp: KorrekturZielTyp,
    zielId: string,
  ): Promise<ZielKontext | null> {
    return this.zielKontext(zielTyp, zielId).catch(() => null);
  }

  /** Offene Korrekturanträge der Organisation (für die Admin-Queue). */
  async offeneAntraege(organisationId: string): Promise<KorrekturantragDTO[]> {
    const antraege = await this.prisma.korrekturantrag.findMany({
      where: {
        status: 'offen',
        OR: [
          { beantragtVon: { organisationId } },
          // Historische Anträge ohne Person-FK: über das Ziel eingegrenzt.
          { beantragtVonId: null },
        ],
      },
      orderBy: { beantragtAm: 'asc' },
    });
    const dtos = await Promise.all(
      antraege.map(async (a) => {
        const ziel = await this.zielKontextOderNull(
          a.zielTyp as KorrekturZielTyp,
          a.zielId,
        );
        if (!ziel) return null;
        const rolle = a.beantragtVonRolle ?? 'Logbuchführend';
        return {
          id: a.id,
          zielTyp: a.zielTyp as KorrekturZielTyp,
          feld: a.feld,
          alterInhalt: a.alterInhalt,
          neuerInhalt: a.neuerInhalt,
          begruendung: a.begruendung,
          beantragtVonName: a.beantragtVonName ?? '—',
          beantragtVonLabel: `${rolle} · ${a.beantragtVonDomaene ?? ziel.domaeneName}`,
          beantragtAm: datumStringAusDate(a.beantragtAm),
          vorschlagId: ziel.vorschlagId,
          vorschlagTitel: ziel.vorschlagTitel,
          domaeneName: ziel.domaeneName,
        } satisfies KorrekturantragDTO;
      }),
    );
    return dtos.filter((d): d is KorrekturantragDTO => d !== null);
  }

  /**
   * Änderungslog: alle bestätigten (Standard) ODER abgelehnten Korrekturen der
   * Organisation, neueste zuerst. Antragsteller anonym als Rollen-Label,
   * entscheidender Admin mit Klarnamen; bei Ablehnung mit Begründung.
   */
  async aenderungslog(
    organisationId: string,
    status: Extract<KorrekturStatus, 'bestaetigt' | 'abgelehnt'> = 'bestaetigt',
  ): Promise<AenderungslogEintragDTO[]> {
    const benachrichtigungTyp =
      status === 'abgelehnt' ? 'korrektur_abgelehnt' : 'korrektur_bestaetigt';
    const antraege = await this.prisma.korrekturantrag.findMany({
      where: {
        status,
        OR: [{ beantragtVon: { organisationId } }, { beantragtVonId: null }],
      },
      orderBy: [{ entschiedenAm: 'desc' }, { id: 'desc' }],
      include: {
        bestaetigtVon: { select: { name: true } },
        benachrichtigungen: {
          where: { typ: benachrichtigungTyp },
          select: { id: true },
          take: 1,
        },
      },
    });
    const dtos = await Promise.all(
      antraege.map(async (a) => {
        const ziel = await this.zielKontextOderNull(
          a.zielTyp as KorrekturZielTyp,
          a.zielId,
        );
        if (!ziel) return null;
        const benachrichtigungId = a.benachrichtigungen.at(0)?.id ?? null;
        const rolle = a.beantragtVonRolle ?? 'Logbuchführend';
        return {
          id: a.id,
          zielTyp: a.zielTyp as KorrekturZielTyp,
          feld: a.feld,
          alterInhalt: a.alterInhalt,
          neuerInhalt: a.neuerInhalt,
          beantragtVonName: a.beantragtVonName ?? '—',
          beantragtVonLabel: `${rolle} · ${a.beantragtVonDomaene ?? ziel.domaeneName}`,
          bestaetigtVonName: a.bestaetigtVonName ?? a.bestaetigtVon?.name ?? '—',
          beantragtAm: datumStringAusDate(a.beantragtAm),
          entschiedenAm: a.entschiedenAm
            ? datumStringAusDate(a.entschiedenAm)
            : '',
          vorschlagId: ziel.vorschlagId,
          vorschlagTitel: ziel.vorschlagTitel,
          domaeneName: ziel.domaeneName,
          status: a.status as KorrekturStatus,
          ablehnungsgrund: a.ablehnungsgrund,
          benachrichtigungId,
        } satisfies AenderungslogEintragDTO;
      }),
    );
    return dtos.filter((d): d is AenderungslogEintragDTO => d !== null);
  }
}
