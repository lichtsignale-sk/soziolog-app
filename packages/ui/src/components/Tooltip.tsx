import { useId, useState, type ReactNode } from 'react';

/**
 * Kurzinfo, die per Hover UND per Tastaturfokus erscheint (nicht nur Hover).
 * Der Trigger ist fokussierbar; der Text ist als role=tooltip verknüpft.
 */
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: ReactNode;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <span
        tabIndex={0}
        aria-describedby={id}
        onMouseEnter={() => setSichtbar(true)}
        onMouseLeave={() => setSichtbar(false)}
        onFocus={() => setSichtbar(true)}
        onBlur={() => setSichtbar(false)}
        className="inline-flex cursor-help"
      >
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-rahmen bg-flaeche px-2 py-1 text-xs text-text shadow-karte transition-opacity ${
          sichtbar ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
