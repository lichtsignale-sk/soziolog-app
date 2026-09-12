import { useId, useRef, useState, type ReactNode } from 'react';

export interface ReiterEintrag {
  schluessel: string;
  titel: string;
  inhalt: ReactNode;
}

/**
 * Barrierefreie Tabs: role=tablist/tab/tabpanel, Pfeiltasten-Navigation,
 * aria-selected. Roving tabindex (nur der aktive Tab ist fokussierbar).
 */
export function Reiter({
  eintraege,
  startSchluessel,
}: {
  eintraege: ReiterEintrag[];
  /** Anfangs aktiver Reiter (per Schlüssel); Standard: erster. */
  startSchluessel?: string;
}) {
  const [aktiv, setAktiv] = useState(() => {
    const i = eintraege.findIndex((e) => e.schluessel === startSchluessel);
    return i >= 0 ? i : 0;
  });
  const basisId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function beiTaste(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const richtung = e.key === 'ArrowRight' ? 1 : -1;
      const naechster = (aktiv + richtung + eintraege.length) % eintraege.length;
      setAktiv(naechster);
      refs.current[naechster]?.focus();
    }
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-rahmen" onKeyDown={beiTaste}>
        {eintraege.map((e, i) => {
          const gewaehlt = i === aktiv;
          return (
            <button
              key={e.schluessel}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${basisId}-tab-${i}`}
              aria-selected={gewaehlt}
              aria-controls={`${basisId}-panel-${i}`}
              tabIndex={gewaehlt ? 0 : -1}
              onClick={() => setAktiv(i)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                gewaehlt
                  ? 'border-primaer text-primaer'
                  : 'border-transparent text-leise hover:text-text'
              }`}
            >
              {e.titel}
            </button>
          );
        })}
      </div>
      {eintraege.map((e, i) => (
        <div
          key={e.schluessel}
          role="tabpanel"
          id={`${basisId}-panel-${i}`}
          aria-labelledby={`${basisId}-tab-${i}`}
          hidden={i !== aktiv}
          className="pt-4"
        >
          {e.inhalt}
        </div>
      ))}
    </div>
  );
}
