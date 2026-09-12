import { ChevronRight } from 'lucide-react';
import type { VorschlagDTO } from '@soziolog/shared';
import { GOVERNANCE_LABEL, VORSCHLAG_STATUS_LABEL } from '../lib/labels';
import { formatDatum } from '../utils/datum';
import { BeschlussBadges } from './BeschlussBadges';

/** Kleiner runder Farbpunkt (Statusanzeige / Zähler-Marker). */
function Punkt({ farbe }: { farbe: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${farbe}`}
    />
  );
}

/** Status-Pille mit führendem Punkt: Entschieden = grün, Offen = bernstein. */
function StatusPille({ status }: { status: VorschlagDTO['status'] }) {
  const text = VORSCHLAG_STATUS_LABEL[status];
  if (status === 'entschieden') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-beschluss-bg px-2.5 py-0.5 text-xs font-medium text-beschluss-text">
        <Punkt farbe="bg-beschluss-rahmen" /> {text}
      </span>
    );
  }
  if (status === 'zurueckgezogen') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-flaeche-3 px-2.5 py-0.5 text-xs font-medium text-leise">
        <Punkt farbe="bg-leise" /> {text}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bedenken-bg px-2.5 py-0.5 text-xs font-medium text-bedenken-text">
      <Punkt farbe="bg-bedenken-rahmen" /> {text}
    </span>
  );
}

/**
 * Kompakte Vorschlags-Karte für die Domänen-Log-Liste (blauer Linksrand,
 * Serifentitel + -vorschau, Fußzeile mit Typ/Ersteller/Datum und Zählern für
 * Bedenken/Einwände). Klick öffnet das Detail-Modal.
 */
export function VorschlagKarte({
  vorschlag,
  onOeffnen,
}: {
  vorschlag: VorschlagDTO;
  onOeffnen: () => void;
}) {
  const anzahlBedenken = vorschlag.bedenken.length;
  const anzahlEinwaende = vorschlag.einwaende.length;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOeffnen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOeffnen();
        }
      }}
      className="cursor-pointer rounded-xl border border-rahmen border-l-[3px] border-l-vorschlag-rahmen bg-flaeche p-5 shadow-karte transition-shadow duration-200 hover:shadow-karte-hover"
    >
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <h3 className="font-serif text-xl font-semibold text-text">{vorschlag.titel}</h3>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {vorschlag.beschluss && (
            <BeschlussBadges beschluss={vorschlag.beschluss} kompakt />
          )}
          <StatusPille status={vorschlag.status} />
        </div>
      </div>
      <p className="line-clamp-2 font-serif text-base leading-relaxed text-read">{vorschlag.inhalt}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-rahmen pt-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-leise">
          <span className="flex items-center gap-1.5">
            <Punkt farbe="bg-vorschlag-rahmen" />
            {GOVERNANCE_LABEL[vorschlag.governanceTyp]}
          </span>
          <span aria-hidden="true">·</span>
          <span>Erfasst von {vorschlag.erfasstVonName}</span>
          <span aria-hidden="true">·</span>
          <span className="ziffern-tabellarisch">{formatDatum(vorschlag.datum)}</span>
          {anzahlBedenken > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1" title={`${anzahlBedenken} Bedenken`}>
                <Punkt farbe="bg-bedenken-rahmen" />
                <span className="ziffern-tabellarisch">{anzahlBedenken}</span>
              </span>
            </>
          )}
          {anzahlEinwaende > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1" title={`${anzahlEinwaende} Einwände`}>
                <Punkt farbe="bg-einwand-rahmen" />
                <span className="ziffern-tabellarisch">{anzahlEinwaende}</span>
              </span>
            </>
          )}
        </div>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primaer bg-primaer-soft text-primaer-softtext"
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
