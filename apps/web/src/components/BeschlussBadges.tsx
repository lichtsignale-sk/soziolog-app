import { Clock } from 'lucide-react';
import type { BeschlussDTO, GueltigkeitStatus } from '@soziolog/shared';
import { BEFRISTUNG_LABEL, GUELTIGKEIT_STATUS_LABEL } from '../lib/labels';
import { formatDatum } from '../utils/datum';

/** Farbklasse der Status-Pille je Gültigkeitsstatus. */
export function statusBadgeKlasse(status: GueltigkeitStatus): string {
  switch (status) {
    case 'gueltig':
      return 'bg-beschluss-bg text-beschluss-text';
    case 'in_ueberpruefung':
      return 'bg-bedenken-bg text-bedenken-text';
    default:
      // ersetzt | beendet – neutral, historisch.
      return 'bg-flaeche-3 text-leise';
  }
}

/**
 * Befristung + Gültigkeitsstatus eines Beschlusses als kompakte Pillen.
 * `kompakt` (Listenkarte): zeigt nur Auffälliges (befristet, nicht-gültig).
 * Voll (Detail): zeigt Befristung und Status immer.
 */
export function BeschlussBadges({
  beschluss,
  kompakt = false,
}: {
  beschluss: Pick<
    BeschlussDTO,
    'befristung' | 'ueberpruefungsdatum' | 'gueltigkeitStatus'
  >;
  kompakt?: boolean;
}) {
  const befristet = beschluss.befristung === 'befristet';
  const statusZeigen = !kompakt || beschluss.gueltigkeitStatus !== 'gueltig';
  const befristungZeigen = !kompakt || befristet;

  if (!statusZeigen && !befristungZeigen) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {befristungZeigen && (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            befristet
              ? 'bg-bedenken-bg text-bedenken-text'
              : 'bg-flaeche-3 text-leise'
          }`}
        >
          {befristet && <Clock className="h-3 w-3" aria-hidden="true" />}
          {BEFRISTUNG_LABEL[beschluss.befristung]}
          {befristet && beschluss.ueberpruefungsdatum && (
            <span className="ziffern-tabellarisch">
              · {formatDatum(beschluss.ueberpruefungsdatum)}
            </span>
          )}
        </span>
      )}
      {statusZeigen && (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeKlasse(
            beschluss.gueltigkeitStatus,
          )}`}
        >
          {GUELTIGKEIT_STATUS_LABEL[beschluss.gueltigkeitStatus]}
        </span>
      )}
    </span>
  );
}
