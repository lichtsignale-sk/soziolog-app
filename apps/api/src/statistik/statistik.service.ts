import { Injectable } from '@nestjs/common';
import type {
  NutzerProDomaene,
  BedenkenProMonat,
  DomaeneEinwaendeBedenken,
  DomaeneEntscheidungen,
} from '@soziolog/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatistikService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nicht-archivierte Domänen der Organisation mit mindestens einem aktiven
   * Mitglied, in Gründungsreihenfolge. Alle Statistik-Zahlen werden live aus den
   * echten Datensätzen aggregiert (keine gespeicherten Anzeige-Zähler mehr).
   */
  private async domaenenMitNutzern(
    organisationId: string,
  ): Promise<{ id: string; name: string; nutzer: number }[]> {
    const domaenen = await this.prisma.domaene.findMany({
      where: { organisationId, archiviert: false },
      select: { id: true, name: true },
      orderBy: { gegruendetAm: 'asc' },
    });
    const gruppen = await this.prisma.mitgliedschaft.groupBy({
      by: ['domaeneId'],
      where: {
        gueltigBis: null,
        person: { aktiv: true },
        domaene: { organisationId, archiviert: false },
      },
      _count: { _all: true },
    });
    const nutzer = new Map(gruppen.map((g) => [g.domaeneId, g._count._all]));
    return domaenen
      .map((k) => ({ id: k.id, name: k.name, nutzer: nutzer.get(k.id) ?? 0 }))
      .filter((k) => k.nutzer > 0);
  }

  async nutzerProDomaene(organisationId: string): Promise<NutzerProDomaene[]> {
    const domaenen = await this.domaenenMitNutzern(organisationId);
    return domaenen.map((k) => ({
      domaeneId: k.id,
      domaeneName: k.name,
      anzahl: k.nutzer,
    }));
  }

  /** Bedenken je Kalendermonat, aggregiert aus den echten Bedenken-Daten. */
  async bedenkenProMonat(
    organisationId: string,
    domaeneId?: string,
  ): Promise<BedenkenProMonat[]> {
    const bedenken = await this.prisma.bedenken.findMany({
      where: {
        vorschlag: {
          domaene: { organisationId, ...(domaeneId ? { id: domaeneId } : {}) },
        },
      },
      select: { datum: true },
    });
    const proMonat = new Map<string, number>();
    for (const b of bedenken) {
      const monat = b.datum.toISOString().slice(0, 7); // YYYY-MM
      proMonat.set(monat, (proMonat.get(monat) ?? 0) + 1);
    }
    return [...proMonat.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monat, anzahl]) => ({ monat, anzahl }));
  }

  async domaeneEinwaendeBedenken(
    organisationId: string,
  ): Promise<DomaeneEinwaendeBedenken[]> {
    const domaenen = await this.domaenenMitNutzern(organisationId);
    const bedenken = await this.prisma.bedenken.findMany({
      where: { vorschlag: { domaene: { organisationId } } },
      select: { vorschlag: { select: { domaeneId: true } } },
    });
    const einwaende = await this.prisma.einwand.findMany({
      where: { vorschlag: { domaene: { organisationId } } },
      select: { schweregrad: true, vorschlag: { select: { domaeneId: true } } },
    });
    const bedenkenZahl = new Map<string, number>();
    for (const b of bedenken) {
      const id = b.vorschlag.domaeneId;
      bedenkenZahl.set(id, (bedenkenZahl.get(id) ?? 0) + 1);
    }
    const leicht = new Map<string, number>();
    const schwer = new Map<string, number>();
    for (const e of einwaende) {
      const ziel = e.schweregrad === 'schwerwiegend' ? schwer : leicht;
      const id = e.vorschlag.domaeneId;
      ziel.set(id, (ziel.get(id) ?? 0) + 1);
    }
    return domaenen.map((k) => ({
      domaeneId: k.id,
      domaeneName: k.name,
      bedenken: bedenkenZahl.get(k.id) ?? 0,
      einwaendeLeicht: leicht.get(k.id) ?? 0,
      einwaendeSchwer: schwer.get(k.id) ?? 0,
    }));
  }

  async domaeneEntscheidungen(
    organisationId: string,
  ): Promise<DomaeneEntscheidungen[]> {
    const domaenen = await this.domaenenMitNutzern(organisationId);
    const gruppen = await this.prisma.vorschlag.groupBy({
      by: ['domaeneId'],
      where: { status: 'entschieden', domaene: { organisationId } },
      _count: { _all: true },
    });
    const beschluesse = new Map(gruppen.map((g) => [g.domaeneId, g._count._all]));
    return domaenen.map((k) => ({
      domaeneId: k.id,
      domaeneName: k.name,
      beschluesse: beschluesse.get(k.id) ?? 0,
    }));
  }
}
