import { UnprocessableEntityException } from '@nestjs/common';
import { heute, zuDatum, datumAusString } from '@soziolog/shared';
import type { Befristung } from '@soziolog/shared';

export interface BefristungEingabe {
  befristung: Befristung;
  ueberpruefungsdatum?: string | null;
}

/**
 * Validiert die Kopplung Befristung ↔ Überprüfungsdatum und gibt das Zieldatum
 * (als Date) bzw. null (unbefristet) zurück. Eine gemeinsame Quelle für das
 * Fassen (VorgangService.erstelleBeschluss) und das erneute Bestätigen
 * (GueltigkeitService.bestaetigeBeschluss).
 */
export function pruefeBefristung(e: BefristungEingabe): Date | null {
  if (e.befristung === 'befristet') {
    if (!e.ueberpruefungsdatum) {
      throw new UnprocessableEntityException(
        'Ein befristeter Beschluss erfordert ein Überprüfungsdatum.',
      );
    }
    const datum = zuDatum(datumAusString(e.ueberpruefungsdatum));
    if (datum.getTime() < zuDatum(heute()).getTime()) {
      throw new UnprocessableEntityException(
        'Das Überprüfungsdatum darf nicht in der Vergangenheit liegen.',
      );
    }
    return datum;
  }
  if (e.ueberpruefungsdatum) {
    throw new UnprocessableEntityException(
      'Ein unbefristeter Beschluss darf kein Überprüfungsdatum haben.',
    );
  }
  return null;
}
