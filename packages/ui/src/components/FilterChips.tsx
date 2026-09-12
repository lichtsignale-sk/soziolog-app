/**
 * Die Filterleiste über einer Liste — `Alle 94 · Offen 12 · Erledigt 6 …`.
 *
 * SIE FILTERT, SIE NAVIGIERT NICHT. Das unterscheidet sie von `Reiter`:
 * Reiter wechseln den Inhalt eines Bereichs, Chips schränken dieselbe Liste
 * ein. Deshalb bekommen sie `role="group"` und gewöhnliche Knöpfe mit
 * `aria-pressed` — nicht `role="tablist"`. Eine Bildschirmleserin soll hier
 * „Schalter gedrückt" hören und nicht „Registerkarte ausgewählt".
 *
 * DIE ZÄHLER SIND TEIL DER AUSSAGE. Ein Chip ohne Zahl zwingt zum
 * Ausprobieren; mit Zahl sieht man vorher, ob sich der Klick lohnt. Sie
 * stehen gedämpft daneben, damit sie die Beschriftung nicht überstimmen.
 *
 * Ein Chip mit Zähler 0 wird NICHT ausgeblendet: „Überfällig 0" ist eine
 * gute Nachricht, und eine Leiste, deren Einträge wandern, lässt sich nicht
 * blind bedienen.
 */

export interface FilterChip<T extends string> {
  wert: T;
  label: string;
  /** Menge hinter der Beschriftung. `undefined` heisst „nicht gezählt". */
  anzahl?: number;
}

export function FilterChips<T extends string>({
  chips,
  aktiv,
  onWaehle,
  beschriftung,
  className,
}: {
  chips: readonly FilterChip<T>[];
  aktiv: T;
  onWaehle: (wert: T) => void;
  /** Wonach gefiltert wird — für die Bildschirmleserin. */
  beschriftung: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={beschriftung}
      className={`inline-flex flex-wrap gap-1 rounded-[10px] border border-rahmen bg-flaeche-3 p-[3px] ${className ?? ''}`}
    >
      {chips.map((chip) => {
        const gewaehlt = chip.wert === aktiv;
        return (
          <button
            key={chip.wert}
            type="button"
            aria-pressed={gewaehlt}
            onClick={() => onWaehle(chip.wert)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              gewaehlt
                ? 'bg-flaeche text-text shadow-[0_1px_3px_rgb(20_40_30/0.10)]'
                : 'text-leise hover:text-text'
            }`}
          >
            {chip.label}
            {chip.anzahl !== undefined && (
              <span className="ml-1.5 opacity-65 ziffern-tabellarisch">{chip.anzahl}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
