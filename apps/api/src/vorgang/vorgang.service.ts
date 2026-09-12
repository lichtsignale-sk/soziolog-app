import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Vorschlag } from '@prisma/client';
import { heute, zuDatum, datumAusString, datumStringAusDate } from '@soziolog/shared';
import type {
  VorschlagDTO,
  BedenkenDTO,
  EinwandDTO,
  BeschlussDTO,
  BeschlussVerweis,
  GovernanceTyp,
  VorschlagStatus,
  EinwandSchweregrad,
  Befristung,
  GueltigkeitStatus,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BenachrichtigungService } from '../benachrichtigung/benachrichtigung.service';
import { pruefeBefristung } from '../gueltigkeit/befristung';
import { VorschlagErstellenDto } from './dto/vorschlag.dto';
import { BedenkenErstellenDto } from './dto/bedenken.dto';
import { EinwandErstellenDto } from './dto/einwand.dto';
import { BeschlussErstellenDto } from './dto/beschluss.dto';

/** Kompakter Verweis auf einen Beschluss samt seines Vorschlags (Ablösungskette). */
const VERWEIS_SELECT = {
  id: true,
  vorschlag: { select: { id: true, titel: true } },
} satisfies Prisma.BeschlussSelect;

const EINTRAG_INCLUDE = {
  domaene: { select: { name: true } },
  erfasstVon: { select: { name: true } },
  bedenken: { orderBy: { datum: 'asc' } },
  einwaende: { orderBy: { datum: 'asc' } },
  beschluss: { include: { ersetztDurch: { select: VERWEIS_SELECT } } },
  ersetztBeschluss: { select: VERWEIS_SELECT },
} satisfies Prisma.VorschlagInclude;

type VorschlagMitEintraegen = Prisma.VorschlagGetPayload<{
  include: typeof EINTRAG_INCLUDE;
}>;
type BeschlussMitNachfolger = VorschlagMitEintraegen['beschluss'];

/** „Gültig": gueltigBis null oder in der Zukunft (frischer Stichtag). */
function gueltigFilter(): { OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }] } {
  return { OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }] };
}

@Injectable()
export class VorgangService {
  private readonly logger = new Logger(VorgangService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly benachrichtigung: BenachrichtigungService,
  ) {}

  /**
   * Benachrichtigt alle gültigen Mitglieder einer Domäne (außer dem Autor) über
   * einen neuen Vorschlag oder Beschluss. Fehler werden isoliert – ein Problem
   * beim Benachrichtigen darf das Anlegen des Vorgangs nicht scheitern lassen.
   */
  private async benachrichtigeUeberVorgang(opts: {
    typ: 'vorschlag_neu' | 'beschluss_neu';
    domaeneId: string;
    titel: string;
    autorId: string;
    vorschlagId: string;
  }): Promise<void> {
    try {
      const [domaene, mitglieder] = await Promise.all([
        this.prisma.domaene.findUnique({
          where: { id: opts.domaeneId },
          select: { name: true },
        }),
        this.prisma.mitgliedschaft.findMany({
          where: { domaeneId: opts.domaeneId, ...gueltigFilter() },
          select: { personId: true },
        }),
      ]);
      const empfaenger = [...new Set(mitglieder.map((m) => m.personId))].filter(
        (id) => id !== opts.autorId,
      );
      if (empfaenger.length === 0) return;

      const domaeneName = domaene?.name ?? 'einer Domäne';
      const inhalt =
        opts.typ === 'vorschlag_neu'
          ? `Neuer Vorschlag in „${domaeneName}": „${opts.titel}".`
          : `Neuer Beschluss in „${domaeneName}": „${opts.titel}".`;

      await this.benachrichtigung.erstelleFuerEmpfaenger(
        {
          typ: opts.typ,
          inhalt,
          domaeneId: opts.domaeneId,
          betrifftVorschlagId: opts.vorschlagId,
        },
        empfaenger,
      );
    } catch (e) {
      this.logger.error(
        `Benachrichtigung (${opts.typ}) für Domäne ${opts.domaeneId} fehlgeschlagen: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }

  /** Übersetzt ein optionales YYYY-MM-DD-Datum, sonst Fallback (Vorschlagsdatum). */
  private datumOderDefault(datum: string | undefined, fallback: Date): Date {
    if (datum === undefined) return fallback;
    return zuDatum(datumAusString(datum));
  }

  private async ladeVorschlagOderFehler(id: string): Promise<Vorschlag> {
    const vorschlag = await this.prisma.vorschlag.findUnique({ where: { id } });
    if (!vorschlag) throw new NotFoundException('Vorschlag nicht gefunden.');
    return vorschlag;
  }

  // ----- Schreiboperationen (Protokollführer-geschützt) -----

  async erstelleVorschlag(
    personId: string,
    domaeneId: string,
    dto: VorschlagErstellenDto,
  ): Promise<VorschlagDTO> {
    const domaene = await this.prisma.domaene.findUnique({ where: { id: domaeneId } });
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');

    if (dto.sitzungId) {
      const sitzung = await this.prisma.sitzung.findFirst({
        where: { id: dto.sitzungId, domaeneId },
        select: { id: true },
      });
      if (!sitzung) {
        throw new BadRequestException('Sitzung gehört nicht zu dieser Domäne.');
      }
    }

    // Neufassung: den abzulösenden Beschluss prüfen (Domäne, Status, noch frei).
    if (dto.ersetztBeschlussId) {
      const alt = await this.prisma.beschluss.findUnique({
        where: { id: dto.ersetztBeschlussId },
        include: {
          vorschlag: { select: { domaeneId: true } },
          neufassungVorschlag: { select: { id: true } },
        },
      });
      if (!alt || alt.vorschlag.domaeneId !== domaeneId) {
        throw new BadRequestException(
          'Der abzulösende Beschluss gehört nicht zu dieser Domäne.',
        );
      }
      if (
        alt.gueltigkeitStatus !== 'gueltig' &&
        alt.gueltigkeitStatus !== 'in_ueberpruefung'
      ) {
        throw new ConflictException(
          'Der abzulösende Beschluss ist bereits abgelöst oder beendet.',
        );
      }
      if (alt.neufassungVorschlag) {
        throw new ConflictException(
          'Für diesen Beschluss wird bereits eine Neufassung erstellt.',
        );
      }
    }

    const vorschlag = await this.prisma.vorschlag.create({
      data: {
        domaeneId,
        erfasstVonId: personId,
        titel: dto.titel,
        inhalt: dto.inhalt,
        governanceTyp: dto.governanceTyp,
        status: 'offen',
        datum: zuDatum(heute()),
        sitzungId: dto.sitzungId ?? null,
        ersetztBeschlussId: dto.ersetztBeschlussId ?? null,
      },
    });

    await this.benachrichtigeUeberVorgang({
      typ: 'vorschlag_neu',
      domaeneId,
      titel: vorschlag.titel,
      autorId: personId,
      vorschlagId: vorschlag.id,
    });

    return this.holeVorschlag(vorschlag.id);
  }

  async fuegeBedenken(
    personId: string,
    vorschlagId: string,
    dto: BedenkenErstellenDto,
  ): Promise<VorschlagDTO> {
    const vorschlag = await this.ladeVorschlagOderFehler(vorschlagId);
    await this.prisma.bedenken.create({
      data: {
        vorschlagId,
        erfasstVonId: personId,
        inhalt: dto.inhalt,
        datum: this.datumOderDefault(dto.datum, vorschlag.datum),
      },
    });
    return this.holeVorschlag(vorschlagId);
  }

  async fuegeEinwand(
    personId: string,
    vorschlagId: string,
    dto: EinwandErstellenDto,
  ): Promise<VorschlagDTO> {
    const vorschlag = await this.ladeVorschlagOderFehler(vorschlagId);

    const integration = dto.integration?.trim() ? dto.integration : null;
    if (dto.schweregrad === 'schwerwiegend' && !integration) {
      throw new UnprocessableEntityException(
        'Ein schwerwiegender Einwand erfordert eine Integration.',
      );
    }

    await this.prisma.einwand.create({
      data: {
        vorschlagId,
        erfasstVonId: personId,
        inhalt: dto.inhalt,
        schweregrad: dto.schweregrad,
        integration,
        datum: this.datumOderDefault(dto.datum, vorschlag.datum),
      },
    });
    return this.holeVorschlag(vorschlagId);
  }

  async erstelleBeschluss(
    personId: string,
    vorschlagId: string,
    dto: BeschlussErstellenDto,
  ): Promise<VorschlagDTO> {
    const vorschlag = await this.prisma.vorschlag.findUnique({
      where: { id: vorschlagId },
      include: { einwaende: true, beschluss: true },
    });
    if (!vorschlag) throw new NotFoundException('Vorschlag nicht gefunden.');

    if (vorschlag.beschluss) {
      throw new ConflictException(
        'Für diesen Vorschlag existiert bereits ein Beschluss.',
      );
    }

    // Regel: alle schwerwiegenden Einwände müssen integriert sein.
    const offenerSchwerer = vorschlag.einwaende.some(
      (e) => e.schweregrad === 'schwerwiegend' && !e.integration?.trim(),
    );
    if (offenerSchwerer) {
      throw new UnprocessableEntityException(
        'Vor dem Beschluss müssen alle schwerwiegenden Einwände integriert sein.',
      );
    }

    // Regel: Befristung ↔ Überprüfungsdatum (gemeinsame Prüfung mit „bestätigen").
    const ueberpruefungsdatum = pruefeBefristung(dto);

    // Ablösung: entweder explizit im DTO oder als Neufassung am Vorschlag hinterlegt.
    const altId = await this.pruefeAbloesung(
      dto.ersetztBeschlussId ?? vorschlag.ersetztBeschlussId ?? undefined,
      vorschlag.domaeneId,
      vorschlagId,
    );

    const tag = zuDatum(heute());
    const operationen: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.beschluss.create({
        data: {
          vorschlagId,
          erfasstVonId: personId,
          inhalt: dto.inhalt,
          notiz: dto.notiz ?? null,
          befristung: dto.befristung,
          ueberpruefungsdatum,
          gueltigkeitStatus: 'gueltig',
          gueltigAb: tag,
          gueltigBis: null,
          datum: tag,
          ersetztBeschlussId: altId,
        },
      }),
      this.prisma.vorschlag.update({
        where: { id: vorschlagId },
        data: { status: 'entschieden' },
      }),
    ];
    if (altId) {
      // Alter Beschluss: gueltigBis = heute (exklusiv), Status = ersetzt.
      operationen.push(
        this.prisma.beschluss.update({
          where: { id: altId },
          data: { gueltigBis: tag, gueltigkeitStatus: 'ersetzt' },
        }),
      );
    }

    try {
      await this.prisma.$transaction(operationen);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = e.meta?.['target'];
        const feld = Array.isArray(target) ? (target as string[]).join(',') : '';
        throw new ConflictException(
          feld.includes('ersetztBeschlussId')
            ? 'Dieser Beschluss wurde bereits abgelöst.'
            : 'Für diesen Vorschlag existiert bereits ein Beschluss.',
        );
      }
      throw e;
    }

    // Ablösung erledigt eine etwaige offene Fällig-Aufgabe des alten Beschlusses.
    if (altId) {
      await this.benachrichtigung.entferneUeberpruefungFaellig(altId);
    }

    const ergebnis = await this.holeVorschlag(vorschlagId);
    await this.benachrichtigeUeberVorgang({
      typ: 'beschluss_neu',
      domaeneId: vorschlag.domaeneId,
      titel: ergebnis.titel,
      autorId: personId,
      vorschlagId,
    });
    return ergebnis;
  }

  /**
   * Prüft die Ablösung eines bestehenden Beschlusses. Gibt dessen Id zurück
   * (oder null, wenn keine Ablösung). Schließt Domäne-Fremdheit, bereits
   * abgelöste/beendete und Selbstbezug aus.
   */
  private async pruefeAbloesung(
    ersetztBeschlussId: string | undefined,
    domaeneId: string,
    vorschlagId: string,
  ): Promise<string | null> {
    if (!ersetztBeschlussId) return null;

    const alt = await this.prisma.beschluss.findUnique({
      where: { id: ersetztBeschlussId },
      include: { vorschlag: { select: { domaeneId: true } } },
    });
    if (!alt) {
      throw new ConflictException('Der abzulösende Beschluss existiert nicht.');
    }
    if (alt.vorschlagId === vorschlagId) {
      throw new BadRequestException(
        'Ein Beschluss kann sich nicht selbst ablösen.',
      );
    }
    if (alt.vorschlag.domaeneId !== domaeneId) {
      throw new ConflictException(
        'Der abzulösende Beschluss gehört zu einer anderen Domäne.',
      );
    }
    if (
      alt.gueltigkeitStatus !== 'gueltig' &&
      alt.gueltigkeitStatus !== 'in_ueberpruefung'
    ) {
      throw new ConflictException(
        'Der abzulösende Beschluss ist bereits abgelöst oder beendet.',
      );
    }
    return alt.id;
  }

  // ----- Leseoperationen (jede angemeldete, aktive Person) -----

  async holeVorschlaegeFuerDomaene(domaeneId: string): Promise<VorschlagDTO[]> {
    const vorschlaege = await this.prisma.vorschlag.findMany({
      where: { domaeneId },
      include: EINTRAG_INCLUDE,
      orderBy: { datum: 'asc' },
    });
    return vorschlaege.map((v) => this.zuVorschlagDTO(v));
  }

  async holeVorschlag(id: string): Promise<VorschlagDTO> {
    const vorschlag = await this.prisma.vorschlag.findUnique({
      where: { id },
      include: EINTRAG_INCLUDE,
    });
    if (!vorschlag) throw new NotFoundException('Vorschlag nicht gefunden.');
    return this.zuVorschlagDTO(vorschlag);
  }

  // ----- Mapping mit Anonymität -----

  private zuVorschlagDTO(v: VorschlagMitEintraegen): VorschlagDTO {
    const label = `Logbuchführer ${v.domaene.name}`;
    return {
      id: v.id,
      domaeneId: v.domaeneId,
      titel: v.titel,
      inhalt: v.inhalt,
      governanceTyp: v.governanceTyp as GovernanceTyp,
      status: v.status as VorschlagStatus,
      datum: datumStringAusDate(v.datum),
      erfasstVonName: v.erfasstVon.name,
      bedenken: v.bedenken.map((b): BedenkenDTO => ({
        id: b.id,
        inhalt: b.inhalt,
        datum: datumStringAusDate(b.datum),
      })),
      einwaende: v.einwaende.map((e): EinwandDTO => ({
        id: e.id,
        inhalt: e.inhalt,
        schweregrad: e.schweregrad as EinwandSchweregrad,
        integration: e.integration,
        datum: datumStringAusDate(e.datum),
      })),
      beschluss: v.beschluss ? this.zuBeschlussDTO(v.beschluss, label) : null,
      neufassungVon: this.zuVerweis(v.ersetztBeschluss),
    };
  }

  /** Verweis auf Beschluss+Vorschlag (Nachfolger/Vorgänger einer Ablösung). */
  private zuVerweis(
    b: { id: string; vorschlag: { id: string; titel: string } } | null,
  ): BeschlussVerweis | null {
    return b
      ? { beschlussId: b.id, vorschlagId: b.vorschlag.id, titel: b.vorschlag.titel }
      : null;
  }

  private zuBeschlussDTO(
    b: NonNullable<BeschlussMitNachfolger>,
    label: string,
  ): BeschlussDTO {
    return {
      id: b.id,
      inhalt: b.inhalt,
      notiz: b.notiz,
      befristung: b.befristung as Befristung,
      ueberpruefungsdatum: b.ueberpruefungsdatum
        ? datumStringAusDate(b.ueberpruefungsdatum)
        : null,
      gueltigkeitStatus: b.gueltigkeitStatus as GueltigkeitStatus,
      gueltigAb: datumStringAusDate(b.gueltigAb),
      gueltigBis: b.gueltigBis ? datumStringAusDate(b.gueltigBis) : null,
      datum: datumStringAusDate(b.datum),
      erfasstVonLabel: label,
      ersetztBeschlussId: b.ersetztBeschlussId,
      ersetztDurch: this.zuVerweis(b.ersetztDurch),
    };
  }
}
