import { Injectable, NotFoundException } from '@nestjs/common';
import type { Domaene } from '@prisma/client';
import type {
  DomaeneKnotenDTO,
  DomaeneDetailDTO,
  DomaeneMitgliedNameDTO,
  DomaeneTyp,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DomaeneLeseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wandelt eine Domäne in ihren Karten-Knoten. Die Zähler werden live aus den
   * echten Vorschlägen aggregiert: `anzahlBeschluesse` = entschiedene
   * Vorschläge, `anzahlOffeneEinwaende` (angezeigt als „N offen") = offene
   * Vorschläge.
   */
  private zuKnoten(
    k: Domaene,
    anzahlBeschluesse: number,
    anzahlOffen: number,
  ): DomaeneKnotenDTO {
    return {
      id: k.id,
      name: k.name,
      ziel: k.ziel,
      tasks: k.tasks,
      typ: k.typ as DomaeneTyp,
      elternDomaeneId: k.elternDomaeneId,
      aktiv: k.aktiv,
      archiviert: k.archiviert,
      anzahlBeschluesse,
      anzahlOffeneEinwaende: anzahlOffen,
    };
  }

  /** Alle Domänen der Organisation inkl. Hierarchie + echten Zählungen. */
  async alleDomaenen(organisationId: string): Promise<DomaeneKnotenDTO[]> {
    const domaenen = await this.prisma.domaene.findMany({
      where: { organisationId },
      orderBy: { gegruendetAm: 'asc' },
    });
    const gruppen = await this.prisma.vorschlag.groupBy({
      by: ['domaeneId', 'status'],
      where: { domaene: { organisationId } },
      _count: { _all: true },
    });
    const beschluesse = new Map<string, number>();
    const offen = new Map<string, number>();
    for (const g of gruppen) {
      if (g.status === 'entschieden') beschluesse.set(g.domaeneId, g._count._all);
      else if (g.status === 'offen') offen.set(g.domaeneId, g._count._all);
    }
    return domaenen.map((k) =>
      this.zuKnoten(k, beschluesse.get(k.id) ?? 0, offen.get(k.id) ?? 0),
    );
  }

  /** Ein Domäne im Detail (mit Name des Eltern-Domäne). */
  async domaeneDetail(organisationId: string, id: string): Promise<DomaeneDetailDTO> {
    const domaene = await this.prisma.domaene.findFirst({
      where: { id, organisationId },
      include: { elternDomaene: { select: { name: true } } },
    });
    if (!domaene) throw new NotFoundException('Domäne nicht gefunden.');
    const anzahlBeschluesse = await this.prisma.vorschlag.count({
      where: { domaeneId: id, status: 'entschieden' },
    });
    const anzahlOffen = await this.prisma.vorschlag.count({
      where: { domaeneId: id, status: 'offen' },
    });
    return {
      ...this.zuKnoten(domaene, anzahlBeschluesse, anzahlOffen),
      elternDomaeneName: domaene.elternDomaene?.name ?? null,
    };
  }

  /**
   * Aktive Mitglieder eines Domäne (nur Name, für die Teilhabenden-Anzeige
   * im Domänen-Log). Die Org-Grenze läuft über die verschachtelte
   * Domäne-Relation, ein Domäne aus fremder Organisation liefert leer.
   */
  async mitgliederDesDomaene(
    organisationId: string,
    domaeneId: string,
  ): Promise<DomaeneMitgliedNameDTO[]> {
    const mitgliedschaften = await this.prisma.mitgliedschaft.findMany({
      where: {
        domaeneId,
        gueltigBis: null,
        domaene: { organisationId },
        person: { aktiv: true },
      },
      include: {
        person: {
          select: { id: true, name: true, avatarColor: true, avatarTextColor: true },
        },
      },
    });
    return mitgliedschaften
      .map((m) => ({
        id: m.person.id,
        name: m.person.name,
        avatarColor: m.person.avatarColor,
        avatarTextColor: m.person.avatarTextColor,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }
}
