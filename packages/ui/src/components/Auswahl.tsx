import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Einheitliches Dropdown: natives <select> ohne Browser-Pfeil (appearance-none)
 * mit eigenem Chevron und Design-System-Rahmen/Fokus. `className` steuert das
 * Layout des Wrappers (z. B. `flex-1`), das Feld füllt ihn.
 */
export function Auswahl({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className ?? ''}`}>
      <select
        className="w-full cursor-pointer appearance-none rounded-lg border border-rahmen bg-flaeche py-2 pl-3 pr-9 text-sm text-text transition-colors hover:border-leise/40 focus:border-primaer focus:outline-none focus:ring-2 focus:ring-primaer/20 disabled:cursor-not-allowed disabled:bg-flaeche-2 disabled:opacity-70"
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-leise"
      />
    </div>
  );
}
