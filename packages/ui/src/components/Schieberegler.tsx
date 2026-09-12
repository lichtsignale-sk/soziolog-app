import { useId } from 'react';

interface Props {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (wert: number) => void;
  /** Menschlich lesbarer Wert für aria-valuetext (z. B. das Datum). */
  wertText?: string;
  /** Sichtbarer Text rechts neben dem Regler (z. B. das Datum). */
  anzeige?: string;
  step?: number;
}

/**
 * Barrierefreier Schieberegler auf Basis von input[type=range]. Der Regler
 * transportiert nur eine Zahl (z. B. einen Tag-Index); die Umrechnung in ein
 * Datum bleibt beim Aufrufer. Fokusring sichtbar, Tastaturbedienung nativ,
 * `prefers-reduced-motion` wird durch den nativen Regler respektiert.
 */
export function Schieberegler({
  label,
  min,
  max,
  value,
  onChange,
  wertText,
  anzeige,
  step = 1,
}: Props) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={wertText}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-flaeche-3 accent-[var(--farbe-primaer)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primaer"
        />
        {anzeige && (
          <span className="ziffern-tabellarisch min-w-[6.5rem] text-right text-sm text-text">
            {anzeige}
          </span>
        )}
      </div>
    </div>
  );
}
