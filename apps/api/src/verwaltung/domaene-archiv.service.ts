import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { heute, zuDatum } from '@soziolog/shared';
import type {
  ArchivierenVorschau,
  ArchivierenEingabe,
  VerwaisendePerson,
  ZielDomaeneOption,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RechteService } from '../rechte/rechte.service';

/** „Gültig": gueltigBis ist null oder liegt in der Zukunft (frischer Stichtag). */
function gueltigFilter(): { OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }] } {
  return { OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }] };
}

/**
 * Reversibles Archivieren von Domänen (ersetzt die frühere einseitige Auflösung).
 * Beim Archivieren gilt weiterhin die Verwaisungsprüfung (Regel b): keine Person
 * darf ohne jede gültige Zugehörigkeit zurückbleiben. Zusätzlich (Regel A9) darf
 * keine Domäne mit noch aktiven Unter-Domänen archiviert werden. Wiederbeleben
 * hebt die Archivierung wieder auf.
 */
@Injectable()
export class DomaeneArchivService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rechte: RechteService,
  ) {}

  /** Domäne der Organisation laden (404, wenn nicht vorhanden/fremd). */
  private async ladeDomaene(organisationId: string, domaeneId: string) {
    const domaene = await this.prisma.domaene.findFirst({
      where: { id: domaeneId, organisationId },
    });
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');
    return domaene;
  }

  /**
   * Personen mit gültiger Mitgliedschaft in der Domäne, die durch das Archivieren
   * verwaisen würden (keine gültige Mitgliedschaft in einer anderen Domäne).
   */
  private async verwaisende(domaeneId: string): Promise<VerwaisendePerson[]> {
    const mitglieder = await this.prisma.mitgliedschaft.findMany({
      where: { domaeneId, ...gueltigFilter() },
      select: { personId: true, person: { select: { name: true } } },
    });
    // Nach personId deduplizieren.
    const proPerson = new Map<string, string>();
    for (const m of mitglieder) proPerson.set(m.personId, m.person.name);

    const ergebnis: VerwaisendePerson[] = [];
    for (const [personId, name] of proPerson) {
      const hatAnderen = await this.rechte.hatMitgliedschaftInAnderemDomaene(
        personId,
        domaeneId,
      );
      if (hatAnderen) continue;
      const rollen = await this.prisma.rollenzuweisung.findMany({
        where: { personId, domaeneId, ...gueltigFilter() },
        select: { rolleTyp: true },
      });
      ergebnis.push({
        personId,
        name,
        rollenImDomaene: rollen.map((r) => r.rolleTyp),
      });
    }
    return ergebnis;
  }

  /** Anzahl aktiver (nicht archivierter) Unter-Domänen (Regel A9). */
  private async aktiveUnterDomaenen(domaeneId: string): Promise<number> {
    return this.prisma.domaene.count({
      where: { elternDomaeneId: domaeneId, archiviert: false },
    });
  }

  /** Vorschau des Archivierens: verwaisende Personen, Optionen und Ziel-Domänen. */
  async vorschau(
    organisationId: string,
    domaeneId: string,
  ): Promise<ArchivierenVorschau> {
    const domaene = await this.ladeDomaene(organisationId, domaeneId);

    const [vorschlaege, aktiveUnter, andereDomaenen, verwaisende] =
      await Promise.all([
        this.prisma.vorschlag.count({ where: { domaeneId } }),
        this.aktiveUnterDomaenen(domaeneId),
        this.prisma.domaene.findMany({
          where: {
            organisationId,
            archiviert: false,
            id: { not: domaeneId },
          },
          select: { id: true, name: true },
          orderBy: { gegruendetAm: 'asc' },
        }),
        this.verwaisende(domaeneId),
      ]);

    const zielDomaenen: ZielDomaeneOption[] = andereDomaenen.map((k) => ({
      id: k.id,
      name: k.name,
    }));

    return {
      domaeneId,
      domaeneName: domaene.name,
      hatEintraege: vorschlaege > 0,
      hatAktiveUnterDomaenen: aktiveUnter > 0,
      verwaisende,
      zielDomaenen,
    };
  }

  /**
   * Archiviert die Domäne. Verwaisenden-Menge wird serverseitig neu berechnet und
   * gegen die Entscheidungen validiert. Alle Teilaktionen laufen atomar in EINER
   * Transaktion; bei jedem Fehler wird alles zurückgerollt. Die Domäne selbst
   * bleibt (reversibel) erhalten – nichts wird hart gelöscht.
   */
  async archivieren(
    organisationId: string,
    domaeneId: string,
    eingabe: ArchivierenEingabe,
  ): Promise<void> {
    const domaene = await this.ladeDomaene(organisationId, domaeneId);
    if (domaene.archiviert) {
      throw new ConflictException('Die Domäne ist bereits archiviert.');
    }

    // Regel A9: kein Archivieren, solange aktive Unter-Domänen bestehen.
    if ((await this.aktiveUnterDomaenen(domaeneId)) > 0) {
      throw new UnprocessableEntityException(
        'Diese Domäne hat noch aktive Unter-Domänen. Archiviere oder verschiebe diese zuerst.',
      );
    }

    const verwaisende = await this.verwaisende(domaeneId);
    const verwaistIds = new Set(verwaisende.map((v) => v.personId));

    // --- Entscheidungen gegen die Verwaisenden-Menge validieren (422) ---
    const entscheidungen = eingabe.entscheidungen ?? [];
    const gesehen = new Set<string>();
    for (const e of entscheidungen) {
      if (gesehen.has(e.personId)) {
        throw new UnprocessableEntityException(
          'Doppelte Entscheidung für dieselbe Person.',
        );
      }
      gesehen.add(e.personId);
      if (!verwaistIds.has(e.personId)) {
        throw new UnprocessableEntityException(
          'Entscheidung für eine Person, die nicht verwaist.',
        );
      }
    }
    for (const id of verwaistIds) {
      if (!gesehen.has(id)) {
        throw new UnprocessableEntityException(
          'Für jede verwaisende Person ist eine Entscheidung erforderlich.',
        );
      }
    }

    const behalten = entscheidungen.filter((e) => e.aktion === 'behalten_in_domaene');
    const loeschen = entscheidungen.filter((e) => e.aktion === 'loeschen');

    // --- Ziel-Domänen prüfen (nicht archiviert, in Org, nicht diese Domäne) ---
    const zielIds = [...new Set(behalten.map((e) => e.zielDomaeneId))];
    for (const e of behalten) {
      if (!e.zielDomaeneId) {
        throw new UnprocessableEntityException(
          'Ziel-Domäne fehlt für „in anderer Domäne behalten".',
        );
      }
      if (e.zielDomaeneId === domaeneId) {
        throw new UnprocessableEntityException(
          'Die Ziel-Domäne darf nicht die zu archivierende Domäne sein.',
        );
      }
    }
    if (zielIds.length > 0) {
      const gueltigeZiele = await this.prisma.domaene.findMany({
        where: {
          id: { in: zielIds as string[] },
          organisationId,
          archiviert: false,
        },
        select: { id: true },
      });
      const gueltigeSet = new Set(gueltigeZiele.map((k) => k.id));
      for (const id of zielIds) {
        if (!id || !gueltigeSet.has(id)) {
          throw new UnprocessableEntityException(
            'Ungültige Ziel-Domäne (archiviert oder nicht in der Organisation).',
          );
        }
      }
    }

    // --- Letzter-Admin-Schutz: kein Deaktivieren des letzten aktiven Admins ---
    const loeschenIds = loeschen.map((e) => e.personId);
    if (loeschenIds.length > 0) {
      const [aktiveAdmins, loeschenPersonen] = await Promise.all([
        this.prisma.person.count({
          where: { organisationId, istAdmin: true, aktiv: true },
        }),
        this.prisma.person.findMany({
          where: { id: { in: loeschenIds } },
          select: { id: true, istAdmin: true, aktiv: true },
        }),
      ]);
      const loeschenAdmins = loeschenPersonen.filter(
        (p) => p.istAdmin && p.aktiv,
      ).length;
      if (aktiveAdmins - loeschenAdmins < 1) {
        throw new UnprocessableEntityException(
          'Der letzte aktive Administrator kann nicht deaktiviert werden.',
        );
      }
    }

    // --- Atomare Ausführung ---
    const stichtag = zuDatum(heute());
    await this.prisma.$transaction(async (tx) => {
      // 1. Behalten: neue Teilhabender-Mitgliedschaft in der Ziel-Domäne (falls
      //    dort noch keine gültige Mitgliedschaft besteht).
      for (const e of behalten) {
        const vorhanden = await tx.mitgliedschaft.findFirst({
          where: { personId: e.personId, domaeneId: e.zielDomaeneId!, ...gueltigFilter() },
          select: { id: true },
        });
        if (!vorhanden) {
          await tx.mitgliedschaft.create({
            data: { personId: e.personId, domaeneId: e.zielDomaeneId!, gueltigAb: stichtag },
          });
        }
      }

      // 2. + 3. Mitgliedschaften und Rollen dieser Domäne weich beenden.
      await tx.mitgliedschaft.updateMany({
        where: { domaeneId, ...gueltigFilter() },
        data: { gueltigBis: stichtag },
      });
      await tx.rollenzuweisung.updateMany({
        where: { domaeneId, ...gueltigFilter() },
        data: { gueltigBis: stichtag },
      });

      // 4. Löschen = deaktivieren (nie hart löschen; erfasstVon-Bezüge bleiben).
      for (const e of loeschen) {
        await tx.person.update({
          where: { id: e.personId },
          data: { aktiv: false },
        });
      }

      // 5. Domäne archivieren (reversibel; Historie und Einträge bleiben).
      await tx.domaene.update({
        where: { id: domaeneId },
        data: { archiviert: true, archiviertAm: stichtag, aktiv: false },
      });
    });
  }

  /**
   * Belebt eine archivierte Domäne wieder (macht sie erneut aktiv). Eine Domäne
   * unter einem archivierten Eltern-Knoten kann NICHT wiederbelebt werden, sonst
   * entstünde ein aktiver Zweig unter einem inaktiven Eltern-Knoten (Regel A9).
   * Beendete Mitgliedschaften/Rollen werden NICHT automatisch wiederhergestellt –
   * die Domäne wird als leere, aktive Hülle wiederbelebt und danach neu besetzt.
   */
  async wiederbeleben(organisationId: string, domaeneId: string): Promise<void> {
    const domaene = await this.ladeDomaene(organisationId, domaeneId);
    if (!domaene.archiviert) {
      throw new ConflictException('Die Domäne ist nicht archiviert.');
    }

    if (domaene.elternDomaeneId) {
      const eltern = await this.prisma.domaene.findUnique({
        where: { id: domaene.elternDomaeneId },
        select: { archiviert: true },
      });
      if (eltern?.archiviert) {
        throw new UnprocessableEntityException(
          'Die übergeordnete Domäne ist archiviert. Belebe zuerst diese wieder.',
        );
      }
    }

    await this.prisma.domaene.update({
      where: { id: domaeneId },
      data: { archiviert: false, archiviertAm: null, aktiv: true },
    });
  }
}
