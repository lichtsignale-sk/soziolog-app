import { useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PersonenBereich } from './admin/PersonenBereich';
import { DomaenenBereich } from './admin/DomaenenBereich';
import { KorrekturenBereich } from './admin/KorrekturenBereich';
import { ExportBereich } from './admin/ExportBereich';

const TABS = [
  { schluessel: 'domaenen', titel: 'Domänen' },
  { schluessel: 'personen', titel: 'Personen' },
  { schluessel: 'korrekturen', titel: 'Korrekturanträge' },
  { schluessel: 'export', titel: 'Export' },
] as const;

export function AdminVerwaltungSeite() {
  const [params] = useSearchParams();
  const basisId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [aktiv, setAktiv] = useState(() => {
    const i = TABS.findIndex((t) => t.schluessel === params.get('tab'));
    return i >= 0 ? i : 0;
  });

  // Auf ?tab=…-Wechsel reagieren (z. B. Sprung aus dem Benachrichtigungs-Popover),
  // auch wenn die Seite schon offen ist.
  const tabParam = params.get('tab');
  useEffect(() => {
    const i = TABS.findIndex((t) => t.schluessel === tabParam);
    if (i >= 0) setAktiv(i);
  }, [tabParam]);

  function beiTaste(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const richtung = e.key === 'ArrowRight' ? 1 : -1;
      const naechster = (aktiv + richtung + TABS.length) % TABS.length;
      setAktiv(naechster);
      refs.current[naechster]?.focus();
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-bold text-text">Verwaltung</h1>
          <p className="mt-1 max-w-2xl text-sm text-leise">
            Domänen und Personen verwalten sowie Korrekturanträge bestätigen.
            Nichts wird gelöscht — Domänen werden archiviert, Personen deaktiviert.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Verwaltungsbereiche"
          onKeyDown={beiTaste}
          className="inline-flex shrink-0 gap-1 self-start rounded-lg border border-rahmen bg-flaeche-3 p-1"
        >
          {TABS.map((t, i) => {
            const gewaehlt = i === aktiv;
            return (
              <button
                key={t.schluessel}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                id={`${basisId}-tab-${i}`}
                aria-selected={gewaehlt}
                aria-controls={`${basisId}-panel-${i}`}
                tabIndex={gewaehlt ? 0 : -1}
                onClick={() => setAktiv(i)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  gewaehlt
                    ? 'bg-flaeche text-text shadow-karte'
                    : 'text-leise hover:text-text'
                }`}
              >
                {t.titel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nur das aktive Panel rendern: so „sieht" der Admin einen Bereich erst,
          wenn er ihn wirklich öffnet (relevant fürs Gelesen-Markieren der
          Korrekturanträge). */}
      <div
        role="tabpanel"
        id={`${basisId}-panel-${aktiv}`}
        aria-labelledby={`${basisId}-tab-${aktiv}`}
      >
        {TABS[aktiv].schluessel === 'domaenen' && <DomaenenBereich />}
        {TABS[aktiv].schluessel === 'personen' && <PersonenBereich />}
        {TABS[aktiv].schluessel === 'korrekturen' && <KorrekturenBereich />}
        {TABS[aktiv].schluessel === 'export' && <ExportBereich />}
      </div>
    </div>
  );
}
