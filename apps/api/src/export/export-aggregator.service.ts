import { Injectable } from '@nestjs/common';
import type { DomaeneKnotenDTO, OrganisationExportGruppe } from '@soziolog/shared';
import { DomaeneLeseService } from '../domaene/domaene-lese.service';
import { VorgangService } from '../vorgang/vorgang.service';

/**
 * Sammelt für den Organisations-Gesamt-Export ALLE Domänen der Organisation
 * (org-gefiltert über DomaeneLeseService) samt ihrer vollständigen Vorgänge
 * (Vorschläge inkl. Bedenken/Einwänden/Beschluss). Bewusst ein eigener Aggregator
 * statt GueltigkeitService.gesamtLog – der filtert nicht nach Organisation und
 * enthält keine Bedenken/Einwände.
 */
@Injectable()
export class ExportAggregatorService {
  constructor(
    private readonly domaenen: DomaeneLeseService,
    private readonly vorgang: VorgangService,
  ) {}

  async organisationVollstaendig(
    organisationId: string,
  ): Promise<OrganisationExportGruppe[]> {
    const knoten = await this.domaenen.alleDomaenen(organisationId);
    const gruppen: OrganisationExportGruppe[] = [];
    for (const k of tiefensuche(knoten)) {
      const [domaene, vorschlaege] = await Promise.all([
        this.domaenen.domaeneDetail(organisationId, k.id),
        this.vorgang.holeVorschlaegeFuerDomaene(k.id),
      ]);
      gruppen.push({ domaene, vorschlaege });
    }
    return gruppen;
  }
}

/** Tiefensuche: Elterndomäne vor ihren Unterdomänen (parent-first), stabil. */
function tiefensuche(knoten: DomaeneKnotenDTO[]): DomaeneKnotenDTO[] {
  const kinder = new Map<string | null, DomaeneKnotenDTO[]>();
  for (const k of knoten) {
    const eltern = k.elternDomaeneId;
    if (!kinder.has(eltern)) kinder.set(eltern, []);
    kinder.get(eltern)!.push(k);
  }
  const ergebnis: DomaeneKnotenDTO[] = [];
  const besuche = (elternId: string | null): void => {
    for (const k of kinder.get(elternId) ?? []) {
      ergebnis.push(k);
      besuche(k.id);
    }
  };
  besuche(null);
  // Sicherheitsnetz: Domänen mit verwaistem Elternteil, die die Suche nicht
  // erreicht hat, hinten anhängen (nichts geht verloren).
  if (ergebnis.length < knoten.length) {
    const gesehen = new Set(ergebnis.map((k) => k.id));
    for (const k of knoten) if (!gesehen.has(k.id)) ergebnis.push(k);
  }
  return ergebnis;
}
