import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, ChevronRight, PencilLine, Clock, FileText, Gavel } from 'lucide-react';
import type {
  BenachrichtigungDTO,
  BenachrichtigungTyp,
  AnzahlUngelesenDTO,
} from '@soziolog/shared';
import { heute } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { EINTRAG } from '../lib/farben';
import { BENACHRICHTIGUNGEN_EVENT } from '../lib/benachrichtigungen';
import { useToast } from '@soziolog/ui';

const POLL_MS = 30_000;

/** Icon je Benachrichtigungstyp. */
const TYP_ICON: Record<BenachrichtigungTyp, typeof Bell> = {
  ueberpruefung_faellig: Clock,
  korrektur_beantragt: PencilLine,
  korrektur_bestaetigt: PencilLine,
  korrektur_abgelehnt: PencilLine,
  vorschlag_neu: FileText,
  beschluss_neu: Gavel,
};

/** Relative Angabe „vor X Tagen" bezogen auf das App-Heute. */
function vorTagen(iso: string): string {
  const tage = Math.round((new Date(heute()).getTime() - new Date(iso).getTime()) / 86_400_000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

export function Benachrichtigungszentrum() {
  const navigate = useNavigate();
  const toast = useToast();
  const [offen, setOffen] = useState(false);
  const [anzahl, setAnzahl] = useState(0);
  const [liste, setListe] = useState<BenachrichtigungDTO[] | null>(null);

  const zaehlerLaden = useCallback(async () => {
    try {
      const res = await apiFetch<AnzahlUngelesenDTO>('/api/benachrichtigungen/anzahl-ungelesen');
      setAnzahl(res.anzahl);
    } catch {
      // still ignorieren; der nächste Poll versucht es erneut.
    }
  }, []);

  useEffect(() => {
    void zaehlerLaden();
    const id = setInterval(() => void zaehlerLaden(), POLL_MS);
    // Sofort aktualisieren, wenn anderswo eine Korrektur entschieden/angeschaut wurde.
    const beiAenderung = () => void zaehlerLaden();
    window.addEventListener(BENACHRICHTIGUNGEN_EVENT, beiAenderung);
    return () => {
      clearInterval(id);
      window.removeEventListener(BENACHRICHTIGUNGEN_EVENT, beiAenderung);
    };
  }, [zaehlerLaden]);

  async function listeLaden() {
    try {
      const res = await apiFetch<BenachrichtigungDTO[]>('/api/benachrichtigungen');
      setListe(res);
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Laden fehlgeschlagen.', 'fehler');
      setListe([]);
    }
  }

  function oeffnen() {
    // Bewusst KEIN Gelesen-Markieren: das reine Öffnen ist noch kein Anschauen.
    setOffen(true);
    setListe(null);
    void listeLaden();
  }

  async function markiere(b: BenachrichtigungDTO) {
    if (b.gelesen) return;
    try {
      await apiFetch(`/api/benachrichtigungen/${b.id}/gelesen`, { method: 'POST' });
      setAnzahl((n) => Math.max(0, n - 1));
    } catch {
      // Nicht kritisch: nächster Poll korrigiert den Zähler.
    }
  }

  function springen(b: BenachrichtigungDTO) {
    setOffen(false);
    if (b.typ === 'korrektur_beantragt') {
      // Zum Korrekturanträge-Tab; das Anschauen dort markiert als gelesen.
      navigate('/admin?tab=korrekturen');
      return;
    }
    void markiere(b);
    if (b.vorschlagId && b.domaeneId) {
      navigate(`/domaenen/${b.domaeneId}?vorschlag=${b.vorschlagId}`);
    } else if (b.typ.startsWith('korrektur_')) {
      navigate('/admin?tab=korrekturen');
    } else if (b.domaeneId) {
      navigate(`/domaenen/${b.domaeneId}`);
    } else {
      navigate('/admin?tab=korrekturen');
    }
  }

  return (
    <div className="relative">
      <button
        onClick={oeffnen}
        className="relative grid h-10 w-10 place-items-center rounded-lg border border-rahmen text-leise transition-colors hover:bg-flaeche-3 hover:text-text"
        aria-label={`Benachrichtigungen${anzahl > 0 ? `, ${anzahl} ungelesen` : ''}`}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {anzahl > 0 && (
          <span
            data-testid="ungelesen-zaehler"
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gefahr px-1 text-[10px] font-bold text-white"
          >
            {anzahl > 9 ? '9+' : anzahl}
          </span>
        )}
      </button>

      {offen && (
        <>
          {/* Klick außerhalb schließt das Popover. */}
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOffen(false)} />
          <div
            role="dialog"
            aria-label="Benachrichtigungen"
            className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-rahmen bg-flaeche shadow-dialog"
          >
            <div className="flex items-center justify-between gap-2 border-b border-rahmen px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text">Benachrichtigungen</h3>
                {anzahl > 0 && (
                  <span className="rounded-full bg-primaer-soft px-2 py-0.5 text-xs font-semibold text-primaer-softtext">
                    {anzahl} neu
                  </span>
                )}
              </div>
              <button
                onClick={() => setOffen(false)}
                aria-label="Schließen"
                className="rounded-md p-1 text-leise hover:bg-flaeche-3"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {liste === null ? (
                <p className="px-4 py-8 text-center text-sm text-leise">Lädt …</p>
              ) : liste.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-leise">
                  Keine neuen Benachrichtigungen.
                </p>
              ) : (
                <ul className="divide-y divide-rahmen">
                  {liste.map((b) => {
                    const Icon = TYP_ICON[b.typ];
                    const istBeantragt = b.typ === 'korrektur_beantragt';
                    const bereich = b.korrekturZielTyp ? EINTRAG[b.korrekturZielTyp] : null;
                    const titel = istBeantragt ? 'Korrekturantrag zu bestätigen' : b.inhalt;
                    return (
                      <li
                        key={b.id}
                        data-testid={`benachrichtigung-${b.id}`}
                        className={b.gelesen ? '' : 'bg-flaeche-2'}
                      >
                        <button
                          onClick={() => springen(b)}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-flaeche-3"
                        >
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-flaeche-3 text-leise">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text">{titel}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-leise">
                              {istBeantragt && bereich ? (
                                <>
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full bg-current ${bereich.text}`}
                                    aria-hidden="true"
                                  />
                                  <span>{bereich.label}</span>
                                  {b.domaeneName && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{b.domaeneName}</span>
                                    </>
                                  )}
                                  <span aria-hidden="true">·</span>
                                  <span>{vorTagen(b.erstelltAm)}</span>
                                </>
                              ) : (
                                <>
                                  {b.domaeneName && (
                                    <>
                                      <span
                                        className="h-1.5 w-1.5 rounded-full bg-primaer"
                                        aria-hidden="true"
                                      />
                                      <span>{b.domaeneName}</span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  <span>{vorTagen(b.erstelltAm)}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-leise" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-rahmen">
              <button
                onClick={() => {
                  setOffen(false);
                  navigate('/admin?tab=korrekturen');
                }}
                className="w-full px-4 py-3 text-center text-sm font-medium text-primaer hover:bg-flaeche-2"
              >
                Alle Korrekturanträge ansehen
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
