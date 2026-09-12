import type { VorschlagStatus } from '@soziolog/shared';
import { VORSCHLAG_STATUS_LABEL } from './labels';

/**
 * Die Eintrags-Codierung (Typ + Farbe + Label + Icon) lebt im Design-System
 * (@soziolog/ui) und wird hier nur weitergereicht, damit die App weiterhin
 * eine einzige Anlaufstelle für Farb-Zuordnungen hat.
 */
export { EINTRAG, type EintragTyp, type EintragStil } from '@soziolog/ui';

/** Status-Pille für einen Vorschlag (offen = blau, entschieden = grün). */
export function statusBadge(status: VorschlagStatus): {
  klasse: string;
  text: string;
} {
  const text = VORSCHLAG_STATUS_LABEL[status];
  if (status === 'entschieden') {
    return { klasse: 'bg-beschluss-bg text-beschluss-text', text };
  }
  if (status === 'zurueckgezogen') {
    return { klasse: 'bg-flaeche-3 text-leise', text };
  }
  return { klasse: 'bg-vorschlag-bg text-vorschlag-text', text };
}
