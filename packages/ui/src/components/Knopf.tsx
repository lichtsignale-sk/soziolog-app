import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaer' | 'sekundaer' | 'sekundaerGruen' | 'gefahr' | 'ghost';
  laedt?: boolean;
}

const STILE: Record<NonNullable<Props['variante']>, string> = {
  primaer:
    'bg-primaer text-primaer-text hover:bg-primaer-hover disabled:opacity-50',
  sekundaer:
    'bg-flaeche text-text border border-rahmen hover:bg-flaeche-3 disabled:opacity-50',
  // Umrandeter „Hinzufügen"-Button mit grüner Schrift (wie im Design).
  sekundaerGruen:
    'bg-flaeche text-primaer border border-rahmen hover:bg-primaer-soft disabled:opacity-50',
  gefahr: 'bg-gefahr text-gefahr-text hover:opacity-90 disabled:opacity-50',
  ghost: 'text-text hover:bg-flaeche-3 disabled:opacity-50',
};

export function Knopf({
  variante = 'primaer',
  laedt = false,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${STILE[variante]} ${className ?? ''}`}
      disabled={disabled || laedt}
      aria-busy={laedt || undefined}
      {...rest}
    >
      {laedt && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
