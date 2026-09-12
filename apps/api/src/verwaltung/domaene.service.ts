import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  heute,
  zuDatum,
  datumStringAusDate,
  MAX_UNTER_UNTER_DOMAENEN,
} from '@soziolog/shared';
import type { RolleTyp, DomaeneMitgliederDTO } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { DbClient } from '../prisma/db-client';

/** „Gültig": gueltigBis null oder in der Zukunft (frischer Stichtag). */
function gueltigFilter(): { OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }] } {
  return { OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }] };
}

export interface Startbesetzung {
  personId: string;
  /** Genau EINE Funktionsrolle pro Person; fehlt sie, ist die Person Teilhabender. */
  rolleTyp?: RolleTyp;
}

export interface DomaeneErstellenEingabe {
  name: string;
  ziel: string;
  tasks: string[];
  typ?: 'dauerdomaene' | 'arbeitsdomaene';
  elternDomaeneId?: string;
  besetzung: Startbesetzung[];
}

export interface DomaeneAktualisierenEingabe {
  name?: string;
  ziel?: string;
  tasks?: string[];
  typ?: 'dauerdomaene' | 'arbeitsdomaene';
  aktiv?: boolean;
}

@Injectable()
export class DomaeneService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Legt einen neuen Domäne an und erzwingt Gründungsregel a. Öffnet eine eigene
   * Transaktion – für den Admin-Weg.
   */
  async erstellen(organisationId: string, eingabe: DomaeneErstellenEingabe) {
    return this.prisma.$transaction((tx) =>
      this.erstellenMit(tx, organisationId, eingabe),
    );
  }

  /**
   * Kern der Domäne-Anlage mit erzwungener Gründungsregel a: mindestens drei
   * verschiedene Mitglieder mit 1× Moderation, 1× Logbuchführer (verschiedene
   * Personen), 1× Teilhabender. Nimmt einen DbClient entgegen, damit der Aufruf
   * an einer umschließenden Transaktion (Setup) teilnehmen kann.
   */
  async erstellenMit(
    db: DbClient,
    organisationId: string,
    eingabe: DomaeneErstellenEingabe,
  ) {
    const besetzung = eingabe.besetzung ?? [];
    const personIds = besetzung.map((b) => b.personId);
    const eindeutige = new Set(personIds);

    if (eindeutige.size < 3) {
      throw new UnprocessableEntityException(
        'Gründungsregel a: Eine Domäne braucht mindestens 3 verschiedene Mitglieder.',
      );
    }

    const moderatoren = besetzung.filter((b) => b.rolleTyp === 'moderation');
    const logbuchfuehrer = besetzung.filter(
      (b) => b.rolleTyp === 'logbuchfuehrer',
    );
    if (moderatoren.length === 0 || logbuchfuehrer.length === 0) {
      throw new UnprocessableEntityException(
        'Gründungsregel a: Es müssen je eine Moderation und eine Logbuchführung besetzt sein.',
      );
    }
    const moderationAufAndererPerson = moderatoren.some((m) =>
      logbuchfuehrer.every((l) => l.personId !== m.personId),
    );
    if (!moderationAufAndererPerson) {
      throw new UnprocessableEntityException(
        'Gründungsregel a: Moderation und Logbuchführung müssen von verschiedenen Personen besetzt sein.',
      );
    }

    // Alle Personen müssen existieren und zur Organisation gehören.
    const gefunden = await db.person.count({
      where: { id: { in: [...eindeutige] }, organisationId },
    });
    if (gefunden !== eindeutige.size) {
      throw new BadRequestException(
        'Mindestens eine angegebene Person existiert nicht in dieser Organisation.',
      );
    }

    if (eingabe.elternDomaeneId) {
      const eltern = await db.domaene.findFirst({
        where: { id: eingabe.elternDomaeneId, organisationId },
        select: {
          id: true,
          elternDomaeneId: true,
          elternDomaene: { select: { elternDomaeneId: true } },
        },
      });
      if (!eltern) {
        throw new BadRequestException('Eltern-Domäne nicht gefunden.');
      }
      // Ebenen: Haupt (0) → Unter (1) → Unter-Unter (2). Eine vierte Ebene gibt
      // es nicht: liegt der Elternteil schon auf Ebene ≥ 2 (hat also selbst
      // einen Großelternteil), wäre das Kind eine unzulässige vierte Ebene.
      if (eltern.elternDomaene?.elternDomaeneId != null) {
        throw new UnprocessableEntityException(
          'Es gibt keine vierte Domänenebene: Unter-Unterdomänen können keine weiteren Unterdomänen haben.',
        );
      }
      // Elternteil auf Ebene 1 (Unterdomäne): höchstens 3 Unter-Unterdomänen.
      if (eltern.elternDomaeneId != null) {
        const anzahlKinder = await db.domaene.count({
          where: { elternDomaeneId: eltern.id, archiviert: false },
        });
        if (anzahlKinder >= MAX_UNTER_UNTER_DOMAENEN) {
          throw new UnprocessableEntityException(
            `Eine Unterdomäne kann höchstens ${MAX_UNTER_UNTER_DOMAENEN} Unter-Unterdomänen haben.`,
          );
        }
      }
    }

    const tag = zuDatum(heute());

    const domaene = await db.domaene.create({
      data: {
        organisationId,
        elternDomaeneId: eingabe.elternDomaeneId ?? null,
        name: eingabe.name,
        ziel: eingabe.ziel,
        tasks: eingabe.tasks,
        typ: eingabe.typ ?? 'dauerdomaene',
        gegruendetAm: tag,
      },
    });

    await db.mitgliedschaft.createMany({
      data: [...eindeutige].map((personId) => ({
        personId,
        domaeneId: domaene.id,
        gueltigAb: tag,
      })),
    });

    // Genau eine Funktionsrolle pro Person (Personen ohne Rolle sind Teilhabende).
    const rollen = besetzung
      .filter((b) => b.rolleTyp)
      .map((b) => ({
        personId: b.personId,
        domaeneId: domaene.id,
        rolleTyp: b.rolleTyp!,
        gueltigAb: tag,
      }));
    if (rollen.length > 0) {
      await db.rollenzuweisung.createMany({ data: rollen });
    }

    return domaene;
  }

  /**
   * Aktuelle (gültige) Mitgliedschaften eines Domäne inkl. der aktuellen
   * Rollen jeder Person in genau diesem Domäne (für die Admin-Verwaltung).
   */
  async mitgliederDetail(
    organisationId: string,
    domaeneId: string,
  ): Promise<DomaeneMitgliederDTO> {
    const domaene = await this.prisma.domaene.findFirst({
      where: { id: domaeneId, organisationId },
      select: { id: true, name: true },
    });
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');

    const [mitgliedschaften, rollen] = await Promise.all([
      this.prisma.mitgliedschaft.findMany({
        where: { domaeneId, ...gueltigFilter() },
        orderBy: { gueltigAb: 'asc' },
        include: { person: { select: { id: true, name: true, nutzername: true } } },
      }),
      this.prisma.rollenzuweisung.findMany({
        where: { domaeneId, ...gueltigFilter() },
        select: { id: true, personId: true, rolleTyp: true, gueltigAb: true },
      }),
    ]);

    return {
      domaeneId: domaene.id,
      domaeneName: domaene.name,
      mitglieder: mitgliedschaften.map((m) => ({
        mitgliedschaftId: m.id,
        personId: m.person.id,
        name: m.person.name,
        nutzername: m.person.nutzername,
        gueltigAb: datumStringAusDate(m.gueltigAb),
        rollen: rollen
          .filter((r) => r.personId === m.person.id)
          .map((r) => ({
            rollenId: r.id,
            rolleTyp: r.rolleTyp as RolleTyp,
            gueltigAb: datumStringAusDate(r.gueltigAb),
          })),
      })),
    };
  }

  async aktualisieren(id: string, eingabe: DomaeneAktualisierenEingabe) {
    const domaene = await this.prisma.domaene.findUnique({ where: { id } });
    if (!domaene) {
      throw new NotFoundException('Domäne nicht gefunden.');
    }
    return this.prisma.domaene.update({
      where: { id },
      data: {
        ...(eingabe.name !== undefined ? { name: eingabe.name } : {}),
        ...(eingabe.ziel !== undefined ? { ziel: eingabe.ziel } : {}),
        ...(eingabe.tasks !== undefined ? { tasks: eingabe.tasks } : {}),
        ...(eingabe.typ !== undefined ? { typ: eingabe.typ } : {}),
        ...(eingabe.aktiv !== undefined ? { aktiv: eingabe.aktiv } : {}),
      },
    });
  }
}
