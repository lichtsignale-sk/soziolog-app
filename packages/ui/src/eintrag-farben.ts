import {
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

/**
 * Zentrale Quelle der Eintrags-Codierung (docs/03). Jeder Typ trägt Farbe UND
 * Label UND Icon — Farbe ist nie das alleinige Signal (Barrierefreiheit).
 * Die Klassen verweisen auf die Design-Tokens (tokens.css). Einwände tragen EINE
 * Farbe; der Schweregrad wird separat als Chip/Label gezeigt.
 */
export type EintragTyp =
  | 'vorschlag'
  | 'bedenken'
  | 'einwand'
  | 'beschluss';

export interface EintragStil {
  label: string;
  Icon: LucideIcon;
  /** Hintergrund-/Rahmen-/Textklassen (Token-basiert). */
  flaeche: string;
  rahmen: string;
  text: string;
}

export const EINTRAG: Record<EintragTyp, EintragStil> = {
  vorschlag: {
    label: 'Vorschlag',
    Icon: FileText,
    flaeche: 'bg-vorschlag-bg',
    rahmen: 'border-vorschlag-rahmen',
    text: 'text-vorschlag-text',
  },
  bedenken: {
    label: 'Bedenken',
    Icon: AlertCircle,
    flaeche: 'bg-bedenken-bg',
    rahmen: 'border-bedenken-rahmen',
    text: 'text-bedenken-text',
  },
  einwand: {
    label: 'Einwand',
    Icon: AlertTriangle,
    flaeche: 'bg-einwand-bg',
    rahmen: 'border-einwand-rahmen',
    text: 'text-einwand-text',
  },
  beschluss: {
    label: 'Beschluss',
    Icon: CheckCircle2,
    flaeche: 'bg-beschluss-bg',
    rahmen: 'border-beschluss-rahmen',
    text: 'text-beschluss-text',
  },
};
