import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { KorrekturantragDTO, KorrekturZielTyp } from '@soziolog/shared';
import { apiFetch, ApiError } from '../../lib/api-client';
import { meldeBenachrichtigungenAktualisiert } from '../../lib/benachrichtigungen';
import { EINTRAG, type EintragTyp } from '../../lib/farben';
import { Knopf, Abzeichen, Dialog, Spinner, useToast } from '@soziolog/ui';
import { formatDatum } from '../../utils/datum';

const FELD_LABEL: Record<string, string> = {
  titel: 'Titel',
  inhalt: 'Inhalt',
  integration: 'Integration',
  notiz: 'Notiz',
};

const BEREICH_FARBE: Record<KorrekturZielTyp, EintragTyp> = {
  vorschlag: 'vorschlag',
  bedenken: 'bedenken',
  einwand: 'einwand',
  beschluss: 'beschluss',
};
const BEREICH_LABEL: Record<KorrekturZielTyp, string> = {
  vorschlag: 'Vorschlag',
  bedenken: 'Bedenken',
  einwand: 'Einwand',
  beschluss: 'Beschluss',
};

export function KorrekturenBereich() {
  const toast = useToast();
  const [antraege, setAntraege] = useState<KorrekturantragDTO[] | null>(null);
  const [aktivId, setAktivId] = useState<string | null>(null);
  const [ablehnung, setAblehnung] = useState<KorrekturantragDTO | null>(null);
  const [grund, setGrund] = useState('');

  function laden() {
    apiFetch<KorrekturantragDTO[]>('/api/korrekturen?status=offen')
      .then(setAntraege)
      .catch(() => setAntraege([]));
  }

  // Das Öffnen dieses Tabs gilt als „angeschaut": offene Korrekturanträge werden
  // für diesen Admin als gelesen markiert (das Popover allein reicht dafür nicht).
  useEffect(() => {
    laden();
    apiFetch('/api/benachrichtigungen/korrektur-beantragt/gelesen', { method: 'POST' })
      .then(() => meldeBenachrichtigungenAktualisiert())
      .catch(() => {});
  }, []);

  async function bestaetigen(id: string) {
    setAktivId(id);
    try {
      await apiFetch(`/api/korrekturen/${id}/bestaetigen`, { method: 'POST' });
      toast.zeige('Korrektur bestätigt.');
      meldeBenachrichtigungenAktualisiert();
      laden();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Aktion fehlgeschlagen.', 'fehler');
    } finally {
      setAktivId(null);
    }
  }

  async function ablehnenBestaetigen() {
    if (!ablehnung || !grund.trim()) return;
    setAktivId(ablehnung.id);
    try {
      await apiFetch(`/api/korrekturen/${ablehnung.id}/ablehnen`, {
        method: 'POST',
        body: JSON.stringify({ grund: grund.trim() }),
      });
      toast.zeige('Korrektur abgelehnt.');
      meldeBenachrichtigungenAktualisiert();
      setAblehnung(null);
      setGrund('');
      laden();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Aktion fehlgeschlagen.', 'fehler');
    } finally {
      setAktivId(null);
    }
  }

  const anzahl = antraege?.length ?? 0;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text">Offene Korrekturanträge</h2>
        {anzahl > 0 && (
          <span className="rounded-full bg-bedenken-bg px-2 py-0.5 text-xs font-semibold text-bedenken-text">
            {anzahl} offen
          </span>
        )}
      </div>

      {antraege === null ? (
        <Spinner />
      ) : antraege.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-rahmen bg-flaeche px-6 py-14 text-center shadow-karte">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-beschluss-bg text-beschluss-text">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-serif text-lg font-semibold text-text">Alle Anträge bearbeitet</p>
          <p className="mt-1 text-sm text-leise">
            Es liegen keine offenen Korrekturanträge vor.
          </p>
          <Link to="/korrekturen-log" className="mt-3 text-sm font-medium text-primaer hover:underline">
            Zum Korrekturen-Log
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {antraege.map((a) => {
            const bereich = EINTRAG[BEREICH_FARBE[a.zielTyp]];
            return (
              <div
                key={a.id}
                data-testid={`korrekturantrag-${a.id}`}
                className="rounded-xl border border-rahmen bg-flaeche p-5 shadow-karte"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-2">
                  <Abzeichen className={`${bereich.flaeche} ${bereich.text}`}>
                    {BEREICH_LABEL[a.zielTyp]}
                  </Abzeichen>
                  <h3 className="font-serif text-lg font-semibold text-text">{a.vorschlagTitel}</h3>
                  <span className="text-xs text-leise">{FELD_LABEL[a.feld] ?? a.feld}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="rounded-lg border border-rahmen bg-flaeche-2 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leise">Aktuell</p>
                    <p className="whitespace-pre-wrap text-sm text-leise line-through">
                      {a.alterInhalt || '—'}
                    </p>
                  </div>
                  <div className="hidden items-center justify-center sm:flex">
                    <ArrowRight className="h-5 w-5 text-leise" aria-hidden="true" />
                  </div>
                  <div className="rounded-lg border border-beschluss-rahmen/40 bg-beschluss-bg p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-beschluss-text">Beantragt</p>
                    <p className="whitespace-pre-wrap text-sm text-text">{a.neuerInhalt}</p>
                  </div>
                </div>

                {a.begruendung && (
                  <p className="mt-3 text-sm text-leise">
                    <span className="font-medium text-text">Begründung:</span> {a.begruendung}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rahmen pt-3">
                  <span className="text-xs text-leise">
                    Antrag von{' '}
                    <span className="font-semibold text-text">{a.beantragtVonName}</span> am{' '}
                    {formatDatum(a.beantragtAm)}
                  </span>
                  <div className="flex gap-2">
                    <Knopf
                      variante="gefahr"
                      disabled={aktivId === a.id}
                      onClick={() => {
                        setGrund('');
                        setAblehnung(a);
                      }}
                    >
                      Ablehnen
                    </Knopf>
                    <Knopf laedt={aktivId === a.id} onClick={() => bestaetigen(a.id)}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Bestätigen
                    </Knopf>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ablehnen mit Pflichtbegründung (M5) */}
      <Dialog
        offen={ablehnung !== null}
        eyebrow="Korrekturantrag ablehnen"
        titel={ablehnung?.vorschlagTitel ?? ''}
        onSchliessen={() => setAblehnung(null)}
        fussleiste={
          <div className="flex justify-end gap-2">
            <Knopf variante="ghost" onClick={() => setAblehnung(null)}>
              Abbrechen
            </Knopf>
            <Knopf
              variante="gefahr"
              disabled={!grund.trim()}
              laedt={aktivId === ablehnung?.id}
              onClick={ablehnenBestaetigen}
            >
              Ablehnen
            </Knopf>
          </div>
        }
      >
        {ablehnung && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-einwand-bg text-einwand-text">
                <XCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm text-leise">
                Antrag von <span className="font-medium text-text">{ablehnung.beantragtVonName}</span>.
                Bitte begründe die Ablehnung – die Begründung erscheint im
                Korrekturen-Log.
              </p>
            </div>
            <div className="rounded-lg border border-einwand-rahmen/40 bg-einwand-bg p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-einwand-text">
                Beantragte Änderung (wird nicht übernommen)
              </p>
              <p className="whitespace-pre-wrap text-sm text-leise line-through">
                {ablehnung.neuerInhalt}
              </p>
            </div>
            <label className="block text-sm font-medium text-text">
              Begründung der Ablehnung
              <textarea
                className="mt-1 block w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-sm text-text focus:border-primaer focus:outline-none"
                rows={3}
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                autoFocus
              />
            </label>
          </div>
        )}
      </Dialog>
    </div>
  );
}
