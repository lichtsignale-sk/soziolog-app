import { forwardRef } from 'react';

interface Props {
  label: string;
  /** Reines Kalenderdatum YYYY-MM-DD (kein Zeitanteil). */
  value?: string;
  onChange?: (wert: string) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  required?: boolean;
  fehler?: string;
  helfertext?: string;
}

/**
 * Kalendertag-Auswahl. Nutzt das native input[type=date], dessen Wert immer ein
 * reiner YYYY-MM-DD-String ohne Uhrzeit ist. Gibt/nimmt ausschließlich diesen
 * String — es wird bewusst KEIN Date-Objekt/DateTime durchgereicht.
 */
export const DatumFeld = forwardRef<HTMLInputElement, Props>(
  function DatumFeld(
    { label, value, onChange, name, id, min, max, required, fehler, helfertext },
    ref,
  ) {
    const feldId = id ?? name ?? 'datum';
    const fehlerId = fehler ? `${feldId}-fehler` : undefined;
    return (
      <div className="mb-4 text-left">
        <label htmlFor={feldId} className="mb-1 block text-sm font-medium text-text">
          {label}
        </label>
        <input
          ref={ref}
          id={feldId}
          name={name}
          type="date"
          value={value ?? ''}
          min={min}
          max={max}
          required={required}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehlerId}
          onChange={(e) => onChange?.(e.target.value)}
          className="ziffern-tabellarisch w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-text focus:border-primaer focus:outline-none"
        />
        {helfertext && !fehler && (
          <p className="mt-1 text-sm text-leise">{helfertext}</p>
        )}
        {fehler && (
          <p id={fehlerId} className="mt-1 text-sm text-gefahr" role="alert">
            {fehler}
          </p>
        )}
      </div>
    );
  },
);
