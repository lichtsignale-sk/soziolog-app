import { EINTRAG, type EintragTyp } from '../eintrag-farben';

/**
 * Abzeichen für einen Eintragstyp: Farbe + Label + Icon zusammen.
 * Kernregel der Barrierefreiheit — die Bedeutung ist nie nur über Farbe erkennbar.
 */
export function EintragAbzeichen({
  typ,
  className,
}: {
  typ: EintragTyp;
  className?: string;
}) {
  const stil = EINTRAG[typ];
  const Icon = stil.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stil.flaeche} ${stil.rahmen} ${stil.text} ${className ?? ''}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {stil.label}
    </span>
  );
}
