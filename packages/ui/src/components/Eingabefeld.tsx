import { forwardRef, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  fehler?: string;
  helfertext?: string;
}

/** Beschriftetes Eingabefeld mit optionaler Fehlermeldung. rhf-kompatibel (ref). */
export const Eingabefeld = forwardRef<HTMLInputElement, Props>(
  function Eingabefeld({ label, fehler, helfertext, id, ...rest }, ref) {
    const feldId = id ?? rest.name;
    const fehlerId = fehler ? `${feldId}-fehler` : undefined;
    return (
      <div className="mb-4 text-left">
        <label
          htmlFor={feldId}
          className="mb-1 block text-sm font-medium text-text"
        >
          {label}
        </label>
        <input
          id={feldId}
          ref={ref}
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehlerId}
          className="w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-text placeholder:text-leise focus:border-primaer focus:outline-none"
          {...rest}
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
