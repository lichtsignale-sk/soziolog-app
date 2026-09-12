import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PencilLine, Check, Lock, Plus, ArrowUpRight, History, Download, Loader2 } from 'lucide-react';
import type { VorschlagDTO } from '@soziolog/shared';
import { apiFetch, ladePdf, ApiError } from '../lib/api-client';
import { Knopf, useToast } from '@soziolog/ui';
import { ProtokollierenFormular } from './ProtokollierenFormular';
import { KorrekturModal, type KorrekturKontext, type KorrekturFeld } from './KorrekturModal';
import { BeschlussBadges } from './BeschlussBadges';
import { BeschlussLebenszyklus } from './BeschlussLebenszyklus';
import { EINTRAG, type EintragTyp } from '../lib/farben';
import { formatDatum } from '../utils/datum';
import { GOVERNANCE_LABEL, SCHWEREGRAD_LABEL } from '../lib/labels';

/** Feld-Bausteine für das Korrektur-Modal (Label + Genus je Feld). */
const wortlautFeld = (wert: string | null): KorrekturFeld => ({
  feld: 'inhalt', label: 'Wortlaut', aktuellLabel: 'Aktueller Wortlaut', neuLabel: 'Neuer Wortlaut', wert,
});
const titelFeld = (wert: string | null): KorrekturFeld => ({
  feld: 'titel', label: 'Titel', aktuellLabel: 'Aktueller Titel', neuLabel: 'Neuer Titel', wert,
});
const integrationFeld = (wert: string | null): KorrekturFeld => ({
  feld: 'integration', label: 'Integration', aktuellLabel: 'Aktuelle Integration', neuLabel: 'Neue Integration', wert,
});
const notizFeld = (wert: string | null): KorrekturFeld => ({
  feld: 'notiz', label: 'Notiz', aktuellLabel: 'Aktuelle Notiz', neuLabel: 'Neue Notiz', wert,
});
const befristungFeld = (wert: string | null): KorrekturFeld => ({
  feld: 'ueberpruefungsdatum', label: 'Befristung', aktuellLabel: 'Aktuelle Befristung',
  neuLabel: 'Neues Überprüfungsdatum (leer = unbefristet)', wert, inputTyp: 'datum',
});

/** Punkt-Farbe je Eintragstyp (gefüllter Marker für die Abschnitts-Überschrift). */
const PUNKT_BG: Record<EintragTyp, string> = {
  vorschlag: 'bg-vorschlag-rahmen',
  bedenken: 'bg-bedenken-rahmen',
  einwand: 'bg-einwand-rahmen',
  beschluss: 'bg-beschluss-rahmen',
};

/** Dezentere Kasten-Umrandung je Typ (gedämpfte Typfarbe statt Vollton). */
const RAHMEN_SUBTIL: Record<EintragTyp, string> = {
  vorschlag: 'border-vorschlag-rahmen/40',
  bedenken: 'border-bedenken-rahmen/40',
  einwand: 'border-einwand-rahmen/40',
  beschluss: 'border-beschluss-rahmen/40',
};

/**
 * Abschnitts-Überschrift über einer Eintragsgruppe: „● Bedenken · anonym".
 * Punkt + Typ-Label (in Typfarbe, optional als Plural) + optionaler
 * „· anonym"-Zusatz.
 */
function AbschnittKopf({
  typ,
  anonym,
  label,
}: {
  typ: EintragTyp;
  anonym?: boolean;
  label?: string;
}) {
  const stil = EINTRAG[typ];
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${PUNKT_BG[typ]}`} aria-hidden="true" />
      <span className={`text-sm font-semibold ${stil.text}`}>{label ?? stil.label}</span>
      {anonym && <span className="text-sm text-leise">· anonym</span>}
    </div>
  );
}

/**
 * Ein farbig markierter Eintrags-Kasten (Bedenken/Einwand/Beschluss). Text links,
 * oben rechts Metadaten (`kopfRechts`, z. B. Datum/Chips) + Bearbeiten-Stift für
 * Protokollführende (öffnet das Korrektur-Modal). `zusatz` läuft über die volle
 * Breite (z. B. Integrations-Box).
 */
function EintragBox({
  typ,
  onBearbeiten,
  children,
  kopfRechts,
  zusatz,
}: {
  typ: EintragTyp;
  onBearbeiten?: () => void;
  children: React.ReactNode;
  kopfRechts?: React.ReactNode;
  zusatz?: React.ReactNode;
}) {
  const stil = EINTRAG[typ];
  return (
    <div className={`rounded-xl border p-4 ${stil.flaeche} ${RAHMEN_SUBTIL[typ]} ${stil.text}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {(kopfRechts || onBearbeiten) && (
          <div className="flex shrink-0 items-center gap-2">
            {kopfRechts}
            {onBearbeiten && (
              <button
                type="button"
                onClick={onBearbeiten}
                aria-label="Bearbeiten"
                className="rounded-md border border-rahmen bg-flaeche p-1 text-leise opacity-80 hover:opacity-100"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      {zusatz}
    </div>
  );
}

/**
 * Vollständiges Vorschlag-Detail-Modal: Vorschlag-Kopf, farbige Einträge
 * (Bedenken/Einwände/Beschluss, nur wenn vorhanden), Bearbeiten-Icons für
 * Protokollführende (öffnen das Korrektur-Modal), sowie eingebettetes
 * Protokollieren solange kein Beschluss existiert.
 */
export function VorschlagFelder({
  vorschlag,
  korrigierbar = false,
  onAktualisiert,
}: {
  vorschlag: VorschlagDTO;
  korrigierbar?: boolean;
  onAktualisiert?: (vorschlag: VorschlagDTO) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const [aktuell, setAktuell] = useState(vorschlag);
  const [protokollierenOffen, setProtokollierenOffen] = useState(false);
  const [korrektur, setKorrektur] = useState<KorrekturKontext | null>(null);
  const [exportLaedt, setExportLaedt] = useState(false);

  async function exportiere() {
    setExportLaedt(true);
    try {
      await ladePdf(`/api/export/vorschlaege/${aktuell.id}/pdf`, `beschluss-${aktuell.id}.pdf`);
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Export fehlgeschlagen.', 'fehler');
    } finally {
      setExportLaedt(false);
    }
  }

  /** Öffnet einen anderen Vorschlag derselben Domäne (Ablösungskette). */
  const zeigeVorschlag = (vorschlagId: string) =>
    navigate(`/domaenen/${aktuell.domaeneId}?vorschlag=${vorschlagId}`);

  useEffect(() => {
    setAktuell(vorschlag);
    setProtokollierenOffen(false);
    setKorrektur(null);
  }, [vorschlag]);

  async function aktualisieren() {
    const v = await apiFetch<VorschlagDTO>(`/api/vorschlaege/${aktuell.id}`);
    setAktuell(v);
    onAktualisiert?.(v);
  }

  const beschlussGesperrt = aktuell.einwaende.some(
    (e) => e.schweregrad === 'schwerwiegend' && !e.integration,
  );
  const entschieden = aktuell.status === 'entschieden';

  const hatEintraege =
    aktuell.bedenken.length > 0 || aktuell.einwaende.length > 0 || !!aktuell.beschluss;

  return (
    <div>
      {/* Zone 1 – weißer Kopf (Pillen, Titel, Inhalt, Erfasser + Bearbeiten). */}
      <div className="px-6 pb-5 pt-6">
        {aktuell.neufassungVon && (
          <button
            type="button"
            onClick={() => zeigeVorschlag(aktuell.neufassungVon!.vorschlagId)}
            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-beschluss-rahmen/40 bg-beschluss-bg px-3 py-2 text-left text-sm text-beschluss-text hover:bg-beschluss-bg/70"
          >
            <History className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Neufassung von{' '}
              <span className="font-semibold">„{aktuell.neufassungVon.titel}"</span> – löst den
              bisherigen Beschluss ab.
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2 pr-12">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-vorschlag-text">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-vorschlag-rahmen" aria-hidden="true" />
            {GOVERNANCE_LABEL[aktuell.governanceTyp]}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
              entschieden ? 'bg-beschluss-bg text-beschluss-text' : 'bg-bedenken-bg text-bedenken-text'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${entschieden ? 'bg-beschluss-rahmen' : 'bg-bedenken-rahmen'}`}
              aria-hidden="true"
            />
            {entschieden ? 'Entschieden' : 'Offen'}
          </span>
        </div>
        <h2 className="mt-3 font-serif text-2xl font-bold text-text md:text-3xl">{aktuell.titel}</h2>
        <p className="mt-3 whitespace-pre-wrap font-serif text-base leading-relaxed text-read md:text-lg">
          {aktuell.inhalt}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="ziffern-tabellarisch text-sm text-leise">
            Erfasst von <span className="font-semibold text-text">{aktuell.erfasstVonName}</span> am{' '}
            <span className="font-semibold text-text">{formatDatum(aktuell.datum)}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={exportiere}
              disabled={exportLaedt}
              aria-label="PDF-Export"
              title="PDF-Export"
              className="shrink-0 rounded-lg border border-rahmen p-1.5 text-leise hover:bg-flaeche-3 disabled:opacity-50"
            >
              {exportLaedt ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {korrigierbar && (
              <button
                type="button"
                onClick={() =>
                  setKorrektur({
                    zielTyp: 'vorschlag',
                    zielId: aktuell.id,
                    chipTyp: 'vorschlag',
                    felder: [titelFeld(aktuell.titel), wortlautFeld(aktuell.inhalt)],
                  })
                }
                aria-label="Vorschlag bearbeiten"
                className="shrink-0 rounded-lg border border-rahmen p-1.5 text-leise hover:bg-flaeche-3"
              >
                <PencilLine className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Zone 2 – graue Eintrags-Zone (Bedenken/Einwände/Beschluss). */}
      {hatEintraege && (
        <div className="space-y-4 border-t border-rahmen bg-flaeche-2 px-6 py-5">
          {aktuell.bedenken.length > 0 && (
            <div>
              <AbschnittKopf typ="bedenken" anonym />
              <div className="space-y-3">
                {aktuell.bedenken.map((b) => (
                  <EintragBox
                    key={b.id}
                    typ="bedenken"
                    onBearbeiten={
                      korrigierbar
                        ? () =>
                            setKorrektur({
                              zielTyp: 'bedenken',
                              zielId: b.id,
                              chipTyp: 'bedenken',
                              felder: [wortlautFeld(b.inhalt)],
                            })
                        : undefined
                    }
                    kopfRechts={
                      <span className="ziffern-tabellarisch text-xs opacity-70">{formatDatum(b.datum)}</span>
                    }
                  >
                    <p className="whitespace-pre-wrap font-serif text-base">{b.inhalt}</p>
                  </EintragBox>
                ))}
              </div>
            </div>
          )}

          {aktuell.einwaende.length > 0 && (
            <div>
              <AbschnittKopf typ="einwand" anonym label="Einwände" />
              <div className="space-y-3">
                {aktuell.einwaende.map((e) => (
                  <EintragBox
                    key={e.id}
                    typ="einwand"
                    onBearbeiten={
                      korrigierbar
                        ? () =>
                            setKorrektur({
                              zielTyp: 'einwand',
                              zielId: e.id,
                              chipTyp: 'einwand',
                              felder: e.integration
                                ? [wortlautFeld(e.inhalt), integrationFeld(e.integration)]
                                : [wortlautFeld(e.inhalt)],
                            })
                        : undefined
                    }
                    kopfRechts={
                      <>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${
                            e.schweregrad === 'schwerwiegend'
                              ? 'border-einwand-rahmen bg-einwand-rahmen text-white'
                              : 'border-einwand-rahmen bg-flaeche text-einwand-text'
                          }`}
                        >
                          {SCHWEREGRAD_LABEL[e.schweregrad]}
                        </span>
                        <span className="ziffern-tabellarisch text-xs opacity-70">{formatDatum(e.datum)}</span>
                      </>
                    }
                    zusatz={
                      e.integration ? (
                        <div className="mt-3 flex gap-3 rounded-lg border border-dashed border-einwand-rahmen/50 bg-flaeche p-3">
                          <span className="mt-0.5 inline-block shrink-0 self-start rounded bg-einwand-bg px-2 py-0.5 text-xs font-medium text-einwand-text">
                            Integration
                          </span>
                          <p className="whitespace-pre-wrap font-serif text-base text-read">
                            {e.integration}
                          </p>
                        </div>
                      ) : korrigierbar ? (
                        <button
                          type="button"
                          onClick={() =>
                            setKorrektur({
                              zielTyp: 'einwand',
                              zielId: e.id,
                              chipTyp: 'einwand',
                              titel: 'Integration ergänzen',
                              felder: [integrationFeld(null)],
                            })
                          }
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-einwand-rahmen/50 bg-flaeche px-3 py-1.5 text-sm font-medium text-einwand-text hover:bg-einwand-bg"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Integration nachträglich hinzufügen
                        </button>
                      ) : undefined
                    }
                  >
                    <p className="whitespace-pre-wrap font-serif text-base">{e.inhalt}</p>
                  </EintragBox>
                ))}
              </div>
            </div>
          )}

          {aktuell.beschluss && (
            <div>
              <AbschnittKopf typ="beschluss" />
              <EintragBox
                typ="beschluss"
                onBearbeiten={
                  korrigierbar
                    ? () =>
                        setKorrektur({
                          zielTyp: 'beschluss',
                          zielId: aktuell.beschluss!.id,
                          chipTyp: 'beschluss',
                          felder: [
                            wortlautFeld(aktuell.beschluss!.inhalt),
                            notizFeld(aktuell.beschluss!.notiz),
                            befristungFeld(aktuell.beschluss!.ueberpruefungsdatum),
                          ],
                        })
                    : undefined
                }
                kopfRechts={
                  <div className="flex flex-col items-end gap-1.5">
                    <BeschlussBadges beschluss={aktuell.beschluss} />
                    <span className="ziffern-tabellarisch text-xs opacity-70">
                      {formatDatum(aktuell.beschluss.datum)}
                    </span>
                  </div>
                }
                zusatz={
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-beschluss-rahmen/20 pt-2 text-xs opacity-80">
                    <span className="ziffern-tabellarisch">
                      Gültig seit {formatDatum(aktuell.beschluss.gueltigAb)}
                    </span>
                    {aktuell.beschluss.gueltigBis && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="ziffern-tabellarisch">
                          {aktuell.beschluss.gueltigkeitStatus === 'ersetzt'
                            ? 'Ersetzt am'
                            : 'Beendet am'}{' '}
                          {formatDatum(aktuell.beschluss.gueltigBis)}
                        </span>
                      </>
                    )}
                    {aktuell.beschluss.ersetztDurch && (
                      <button
                        type="button"
                        onClick={() => zeigeVorschlag(aktuell.beschluss!.ersetztDurch!.vorschlagId)}
                        className="inline-flex items-center gap-1 font-medium text-primaer hover:underline"
                      >
                        Nachfolgebeschluss ansehen
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                }
              >
                <div className="flex gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p className="whitespace-pre-wrap font-serif text-base">{aktuell.beschluss.inhalt}</p>
                </div>
              </EintragBox>

              {korrigierbar && aktuell.beschluss.gueltigkeitStatus === 'in_ueberpruefung' && (
                <div className="mt-3">
                  <BeschlussLebenszyklus
                    beschluss={aktuell.beschluss}
                    domaeneId={aktuell.domaeneId}
                    onErledigt={() => void aktualisieren()}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zone 3 – weißer Fuß (nur für Protokollführende). */}
      {korrigierbar &&
        (aktuell.beschluss ? (
          <div className="border-t border-rahmen px-6 py-4">
            <p className="flex items-start gap-2 text-sm text-leise">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Beschluss gefasst. Änderungen an Einträgen lösen einen{' '}
                <span className="font-medium text-text">Korrekturantrag</span> aus — nutze dafür das
                Bearbeiten-Symbol am jeweiligen Eintrag.
              </span>
            </p>
          </div>
        ) : protokollierenOffen ? (
          <div className="border-t border-rahmen px-6 py-4">
            <ProtokollierenFormular
              vorschlagId={aktuell.id}
              beschlussGesperrt={beschlussGesperrt}
              onGespeichert={() => {
                setProtokollierenOffen(false);
                void aktualisieren();
              }}
              onAbbrechen={() => setProtokollierenOffen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rahmen px-6 py-4">
            <p className="text-sm text-leise">
              Noch kein Beschluss. Es können beliebig viele Bedenken und Einwände ergänzt werden.
            </p>
            <Knopf onClick={() => setProtokollierenOffen(true)}>
              <PencilLine className="h-4 w-4" aria-hidden="true" />
              Protokollieren
            </Knopf>
          </div>
        ))}

      {korrektur && (
        <KorrekturModal korrektur={korrektur} onSchliessen={() => setKorrektur(null)} />
      )}
    </div>
  );
}
