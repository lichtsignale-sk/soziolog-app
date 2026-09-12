import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { heute, zuDatum, datumStringAusDate } from '@soziolog/shared';
import type { AdminPersonDTO, RolleTyp } from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EinladungService } from './einladung.service';
import type { DbClient } from '../prisma/db-client';

/** „Gültig": gueltigBis null oder in der Zukunft (frischer Stichtag). */
function gueltigFilter(): { OR: [{ gueltigBis: null }, { gueltigBis: { gt: Date } }] } {
  return { OR: [{ gueltigBis: null }, { gueltigBis: { gt: zuDatum(heute()) } }] };
}

export interface PersonAnlegenEingabe {
  name: string;
  nutzername: string;
  loginEmail: string;
  istAdmin?: boolean;
}

export interface PersonAktualisierenEingabe {
  aktiv?: boolean;
  istAdmin?: boolean;
}

/** Öffentliche Personendaten (nie passwortHash). */
function oeffentlich(person: {
  id: string;
  organisationId: string;
  name: string;
  nutzername: string;
  loginEmail: string;
  istAdmin: boolean;
  aktiv: boolean;
  benachrichtigungenAktiv: boolean;
}) {
  return {
    id: person.id,
    organisationId: person.organisationId,
    name: person.name,
    nutzername: person.nutzername,
    loginEmail: person.loginEmail,
    istAdmin: person.istAdmin,
    aktiv: person.aktiv,
    benachrichtigungenAktiv: person.benachrichtigungenAktiv,
  };
}

@Injectable()
export class PersonVerwaltungService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly einladung: EinladungService,
  ) {}

  /** Anzahl weiterer aktiver Admins (die angegebene Person ausgenommen). */
  private async andereAktivenAdmins(ausserId: string): Promise<number> {
    return this.prisma.person.count({
      where: { istAdmin: true, aktiv: true, id: { not: ausserId } },
    });
  }

  /** Eine Person (öffentliche Felder), 404 wenn nicht gefunden. */
  async hole(id: string) {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) throw new NotFoundException('Person nicht gefunden.');
    return oeffentlich(person);
  }

  /**
   * Alle Personen der Organisation mit ihren aktuell gültigen Domänen/Rollen
   * (für die Admin-Personenliste). Nutzt dieselbe Gültigkeitsdefinition wie
   * RechteService.gueltigWhere (gueltigBis null oder in der Zukunft).
   */
  async alle(organisationId: string): Promise<AdminPersonDTO[]> {
    const personen = await this.prisma.person.findMany({
      where: { organisationId },
      orderBy: { angelegtAm: 'asc' },
      include: {
        mitgliedschaften: {
          where: gueltigFilter(),
          include: { domaene: { select: { id: true, name: true } } },
        },
        rollen: { where: gueltigFilter(), select: { domaeneId: true, rolleTyp: true } },
      },
    });

    return personen.map((p) => {
      // Status abgeleitet: deaktiviert, eingeladen (aktiv ohne Passwort), sonst aktiv.
      const status: AdminPersonDTO['status'] = !p.aktiv
        ? 'deaktiviert'
        : p.passwortHash === null
          ? 'eingeladen'
          : 'aktiv';
      // Berechtigung abgeleitet (nur für schon eingelöste Konten).
      const berechtigung: AdminPersonDTO['berechtigung'] =
        status === 'eingeladen'
          ? null
          : p.istAdmin
            ? 'Administrativ'
            : p.rollen.some((r) => r.rolleTyp === 'logbuchfuehrer')
              ? 'Protokollierend'
              : 'Teilhabend';
      return {
        id: p.id,
        name: p.name,
        nutzername: p.nutzername,
        loginEmail: p.loginEmail,
        avatarColor: p.avatarColor,
        avatarTextColor: p.avatarTextColor,
        istAdmin: p.istAdmin,
        aktiv: p.aktiv,
        status,
        berechtigung,
        benachrichtigungenAktiv: p.benachrichtigungenAktiv,
        angelegtAm: datumStringAusDate(p.angelegtAm),
        domaenen: p.mitgliedschaften.map((m) => ({
          domaeneId: m.domaene.id,
          name: m.domaene.name,
          rollen: p.rollen
            .filter((r) => r.domaeneId === m.domaene.id)
            .map((r) => r.rolleTyp as RolleTyp),
        })),
      };
    });
  }

  /**
   * Legt eine neue Person an (ohne Passwort – Aktivierung erfolgt per Einladung)
   * und stellt sofort eine offene Einladung aus. Der Klartext-Token wird
   * zurückgegeben (für den Versand durch den Aufrufer). Ein optionaler
   * DbClient erlaubt die Teilnahme an einer Transaktion (Setup).
   */
  async anlegen(
    organisationId: string,
    eingabe: PersonAnlegenEingabe,
    db: DbClient = this.prisma,
  ) {
    try {
      const person = await db.person.create({
        data: {
          organisationId,
          name: eingabe.name,
          nutzername: eingabe.nutzername,
          loginEmail: eingabe.loginEmail,
          istAdmin: eingabe.istAdmin ?? false,
          passwortHash: null,
          aktiv: true,
        },
      });
      const einladungToken = await this.einladung.neuAusstellen(person.id, db);
      return { person: oeffentlich(person), einladungToken };
    } catch (e) {
      throw this.uebersetzeKollision(e);
    }
  }

  async aktualisieren(id: string, eingabe: PersonAktualisierenEingabe) {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) {
      throw new NotFoundException('Person nicht gefunden.');
    }

    // Selbst-Aussperr-Schutz: den letzten aktiven Admin nicht entmachten.
    const entziehtAdmin =
      person.istAdmin &&
      (eingabe.istAdmin === false || eingabe.aktiv === false);
    if (entziehtAdmin && (await this.andereAktivenAdmins(id)) === 0) {
      throw new UnprocessableEntityException(
        'Der letzte aktive Administrator kann nicht deaktiviert oder degradiert werden.',
      );
    }

    const person2 = await this.prisma.person.update({
      where: { id },
      data: {
        ...(eingabe.aktiv !== undefined ? { aktiv: eingabe.aktiv } : {}),
        ...(eingabe.istAdmin !== undefined ? { istAdmin: eingabe.istAdmin } : {}),
      },
    });
    return oeffentlich(person2);
  }

  /**
   * Löscht eine Person unter Wahrung der referentiellen Integrität. Personen mit
   * unveränderlichen Log-Einträgen (Vorschlag/Bedenken/Einwand/Beschluss/
   * Korrektur) werden NICHT gelöscht (nur deaktivierbar). Sonst werden
   * abhängige, nicht-inhaltliche Zeilen mitentfernt.
   */
  async loeschen(id: string): Promise<void> {
    const person = await this.prisma.person.findUnique({ where: { id } });
    if (!person) {
      throw new NotFoundException('Person nicht gefunden.');
    }

    if (person.istAdmin && (await this.andereAktivenAdmins(id)) === 0) {
      throw new UnprocessableEntityException(
        'Der letzte aktive Administrator kann nicht gelöscht werden.',
      );
    }

    const [vorschlaege, bedenken, einwaende, beschluesse, korrekturen] =
      await Promise.all([
        this.prisma.vorschlag.count({ where: { erfasstVonId: id } }),
        this.prisma.bedenken.count({ where: { erfasstVonId: id } }),
        this.prisma.einwand.count({ where: { erfasstVonId: id } }),
        this.prisma.beschluss.count({ where: { erfasstVonId: id } }),
        this.prisma.korrekturantrag.count({
          where: { OR: [{ beantragtVonId: id }, { bestaetigtVonId: id }] },
        }),
      ]);

    if (vorschlaege + bedenken + einwaende + beschluesse + korrekturen > 0) {
      throw new ConflictException(
        'Diese Person hat unveränderliche Log-Einträge und kann nicht gelöscht, nur deaktiviert werden.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.einladung.deleteMany({ where: { personId: id } }),
      this.prisma.passwortReset.deleteMany({ where: { personId: id } }),
      this.prisma.benachrichtigungEmpfang.deleteMany({ where: { personId: id } }),
      this.prisma.rollenzuweisung.deleteMany({ where: { personId: id } }),
      this.prisma.mitgliedschaft.deleteMany({ where: { personId: id } }),
      this.prisma.person.delete({ where: { id } }),
    ]);
  }

  private uebersetzeKollision(e: unknown): unknown {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      const target = e.meta?.['target'];
      const feld = Array.isArray(target)
        ? (target as string[]).join(', ')
        : 'Nutzername oder E-Mail';
      return new ConflictException(`Bereits vergeben: ${feld}.`);
    }
    return e;
  }
}
