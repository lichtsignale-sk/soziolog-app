import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  NutzerProDomaene,
  BedenkenProMonat,
  DomaeneEinwaendeBedenken,
  DomaeneEntscheidungen,
} from '@soziolog/shared';
import { apiFetch } from '../lib/api-client';
import { Auswahl, Spinner } from '@soziolog/ui';

const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
/** „2026-07" → „Jul". */
function monatKurz(iso: string): string {
  const m = parseInt(iso.slice(5, 7), 10);
  return MONATE[m - 1] ?? iso;
}

/** Statistik-Kachel: Punkt-Marker + Serif-Titel + Kurzbeschreibung + Visualisierung. */
function Kachel({
  punkt,
  titel,
  beschreibung,
  aktion,
  children,
}: {
  punkt: string;
  titel: string;
  beschreibung: string;
  aktion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-rahmen bg-flaeche p-6 shadow-karte">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-text">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${punkt}`} />
          {titel}
        </h2>
        {aktion}
      </div>
      <p className="mb-5 text-sm text-leise">{beschreibung}</p>
      {children}
    </section>
  );
}

/** Horizontale Balkenzeile mit hellem Track, Wert rechts. */
function HBalken({
  label,
  wert,
  max,
  farbe,
}: {
  label: string;
  wert: number;
  max: number;
  farbe: string;
}) {
  const breite = max > 0 ? Math.max(2, (wert / max) * 100) : 2;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-right text-leise" title={label}>
        {label}
      </span>
      <div className="h-6 flex-1 overflow-hidden rounded-md bg-flaeche-3">
        <div
          className={`h-full rounded-md ${farbe}`}
          style={{ width: `${breite}%` }}
        />
      </div>
      <span className="ziffern-tabellarisch w-6 shrink-0 text-right font-semibold text-text">
        {wert}
      </span>
    </div>
  );
}

export function Statistik() {
  const [nutzer, setNutzer] = useState<NutzerProDomaene[] | null>(null);
  const [einwB, setEinwB] = useState<DomaeneEinwaendeBedenken[] | null>(null);
  const [entsch, setEntsch] = useState<DomaeneEntscheidungen[] | null>(null);
  const [monat, setMonat] = useState<BedenkenProMonat[] | null>(null);
  const [domaeneFilter, setDomaeneFilter] = useState('');

  useEffect(() => {
    apiFetch<NutzerProDomaene[]>('/api/statistik/nutzer-pro-domaene')
      .then(setNutzer)
      .catch(() => setNutzer([]));
    apiFetch<DomaeneEinwaendeBedenken[]>('/api/statistik/domaene-einwaende-bedenken')
      .then(setEinwB)
      .catch(() => setEinwB([]));
    apiFetch<DomaeneEntscheidungen[]>('/api/statistik/domaene-entscheidungen')
      .then(setEntsch)
      .catch(() => setEntsch([]));
  }, []);

  useEffect(() => {
    const query = domaeneFilter ? `?domaeneId=${domaeneFilter}` : '';
    apiFetch<BedenkenProMonat[]>(`/api/statistik/bedenken-pro-monat${query}`)
      .then(setMonat)
      .catch(() => setMonat([]));
  }, [domaeneFilter]);

  const domaenen = useMemo(
    () => (nutzer ?? []).map((n) => ({ id: n.domaeneId, name: n.domaeneName })),
    [nutzer],
  );

  if (nutzer === null || einwB === null || entsch === null || monat === null) {
    return <Spinner />;
  }

  const maxNutzer = Math.max(1, ...nutzer.map((n) => n.anzahl));
  const maxMonat = Math.max(1, ...monat.map((m) => m.anzahl));
  const einwBReihen = einwB.map((d) => ({
    ...d,
    einwaende: d.einwaendeLeicht + d.einwaendeSchwer,
  }));
  const maxEinwB = Math.max(1, ...einwBReihen.map((d) => Math.max(d.bedenken, d.einwaende)));
  const maxEntsch = Math.max(1, ...entsch.map((d) => d.beschluesse));

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-text">Statistik</h1>
      <p className="mb-6 mt-1 text-sm text-leise">
        Kennzahlen über alle Domänen hinweg — jede Kachel mit sichtbaren Werten
        und Datentabelle.
      </p>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-2">
        {/* 1) Nutzer je Domäne — horizontale Balken */}
        <Kachel
          punkt="bg-primaer"
          titel="Nutzer je Domäne"
          beschreibung="Wie viele Teilhabende jeder Domäne zugeordnet sind."
        >
          <div className="space-y-2.5">
            {nutzer.map((n) => (
              <HBalken
                key={n.domaeneId}
                label={n.domaeneName}
                wert={n.anzahl}
                max={maxNutzer}
                farbe="bg-primaer"
              />
            ))}
          </div>
        </Kachel>

        {/* 2) Bedenken je Monat — Säulen */}
        <Kachel
          punkt="bg-bedenken-rahmen"
          titel="Bedenken je Monat"
          beschreibung="Wie viele Bedenken je Kalendermonat erfasst wurden."
          aktion={
            <label className="flex items-center gap-2 text-sm text-leise">
              Domäne
              <Auswahl
                value={domaeneFilter}
                onChange={(e) => setDomaeneFilter(e.target.value)}
              >
                <option value="">Alle</option>
                {domaenen.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </Auswahl>
            </label>
          }
        >
          {monat.length === 0 ? (
            <p className="py-8 text-center text-sm text-leise">Keine Bedenken im Zeitraum.</p>
          ) : (
            <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
              {monat.map((m) => (
                <div key={m.monat} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="ziffern-tabellarisch text-xs font-semibold text-text">
                    {m.anzahl}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-bedenken-rahmen"
                    style={{ height: `${(m.anzahl / maxMonat) * 130}px` }}
                  />
                  <span className="text-xs text-leise">{monatKurz(m.monat)}</span>
                </div>
              ))}
            </div>
          )}
        </Kachel>

        {/* 3) Bedenken & Einwände je Domäne — gruppierte Balken */}
        <Kachel
          punkt="bg-einwand-rahmen"
          titel="Bedenken & Einwände je Domäne"
          beschreibung="Wo entsteht viel bzw. wenig Widerspruch?"
        >
          <div className="mb-3 flex items-center gap-4 text-xs text-leise">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-bedenken-rahmen" /> Bedenken
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-einwand-rahmen" /> Einwände
            </span>
          </div>
          <div className="space-y-3">
            {einwBReihen.map((d) => (
              <div key={d.domaeneId}>
                <p className="mb-1 text-sm text-leise">{d.domaeneName}</p>
                <div className="space-y-1">
                  <HBalken label="Bedenken" wert={d.bedenken} max={maxEinwB} farbe="bg-bedenken-rahmen" />
                  <HBalken label="Einwände" wert={d.einwaende} max={maxEinwB} farbe="bg-einwand-rahmen" />
                </div>
              </div>
            ))}
          </div>
        </Kachel>

        {/* 4) Entscheidungen je Domäne — horizontale Balken */}
        <Kachel
          punkt="bg-beschluss-rahmen"
          titel="Entscheidungen je Domäne"
          beschreibung="Gefasste Beschlüsse insgesamt je Domäne."
        >
          <div className="space-y-2.5">
            {entsch.map((d) => (
              <HBalken
                key={d.domaeneId}
                label={d.domaeneName}
                wert={d.beschluesse}
                max={maxEntsch}
                farbe="bg-beschluss-rahmen"
              />
            ))}
          </div>
        </Kachel>
      </div>
    </div>
  );
}
