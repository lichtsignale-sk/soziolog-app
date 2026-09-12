import { useEffect, useState } from 'react';
import { History, ArrowRight, ChevronRight } from 'lucide-react';
import type { AenderungslogEintragDTO, KorrekturZielTyp, VorschlagDTO } from '@soziolog/shared';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../context/AuthContext';
import { EINTRAG, type EintragTyp } from '../lib/farben';
import { Dialog, LeerZustand, Spinner } from '@soziolog/ui';
import { VorschlagFelder } from '../components/VorschlagFelder';
import { formatDatum } from '../utils/datum';

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

export function KorrekturenLogSeite() {
  const { person } = useAuth();
  const [eintraege, setEintraege] = useState<AenderungslogEintragDTO[] | null>(null);
  const [modalVorschlag, setModalVorschlag] = useState<VorschlagDTO | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<AenderungslogEintragDTO[]>('/api/aenderungslog'),
      apiFetch<AenderungslogEintragDTO[]>('/api/aenderungslog?status=abgelehnt'),
    ])
      .then(([bestaetigt, abgelehnt]) => {
        const alle = [...bestaetigt, ...abgelehnt].sort((a, b) =>
          b.entschiedenAm.localeCompare(a.entschiedenAm),
        );
        setEintraege(alle);
      })
      .catch(() => setEintraege([]));
  }, []);

  const korrigierbar =
    !!person?.istAdmin ||
    !!person?.domaenen
      .find((k) => k.domaeneId === modalVorschlag?.domaeneId)
      ?.rollen.includes('logbuchfuehrer');

  async function oeffneVorschlag(vorschlagId: string) {
    const v = await apiFetch<VorschlagDTO>(`/api/vorschlaege/${vorschlagId}`);
    setModalVorschlag(v);
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-text">Korrekturen-Log</h1>
      <p className="mb-8 mt-1 max-w-2xl text-sm text-leise">
        Jeder inhaltliche Korrekturantrag – transparent dokumentiert, ob bestätigt
        oder abgelehnt. Antragsteller und entscheidender Admin jeweils namentlich
        nachvollziehbar.
      </p>

      {eintraege === null ? (
        <Spinner />
      ) : eintraege.length === 0 ? (
        <LeerZustand
          Icon={History}
          titel="Noch keine Korrekturen"
          hinweis="Sobald ein Admin einen Korrekturantrag bestätigt, erscheint die Korrektur hier."
        />
      ) : (
        <ol>
          {eintraege.map((e) => {
            const bereich = EINTRAG[BEREICH_FARBE[e.zielTyp]];
            const abgelehnt = e.status === 'abgelehnt';
            // Feld ins Pill ziehen (bei „inhalt" nur der Bereich, sonst „Bereich · Feld").
            const pillLabel =
              e.feld === 'inhalt'
                ? BEREICH_LABEL[e.zielTyp]
                : `${BEREICH_LABEL[e.zielTyp]} · ${FELD_LABEL[e.feld] ?? e.feld}`;
            return (
              <li key={e.id} className="grid grid-cols-[4.5rem_1.5rem_1fr] gap-x-2 sm:grid-cols-[6rem_1.5rem_1fr] sm:gap-x-3">
                {/* Datum */}
                <div className="ziffern-tabellarisch pt-5 text-right text-sm text-leise">
                  {formatDatum(e.entschiedenAm)}
                </div>
                {/* Zeitstrahl: Linie + Knoten */}
                <div className="relative flex justify-center">
                  <span aria-hidden="true" className="absolute inset-y-0 w-px bg-rahmen" />
                  <span
                    aria-hidden="true"
                    className="relative mt-[22px] h-3 w-3 rounded-full border-2 border-primaer bg-flaeche"
                  />
                </div>
                {/* Karte */}
                <div className="pb-6">
                  <div className="rounded-xl border border-rahmen bg-flaeche p-5 shadow-karte">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${bereich.flaeche} ${bereich.text}`}
                        >
                          {pillLabel}
                        </span>
                        <h3 className="font-serif text-lg font-semibold text-text">
                          {e.vorschlagTitel}
                        </h3>
                        {abgelehnt && (
                          <span className="rounded-full bg-einwand-bg px-2 py-0.5 text-sm font-semibold text-einwand-text">
                            Abgelehnt
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => oeffneVorschlag(e.vorschlagId)}
                        aria-label={`Vorschlag „${e.vorschlagTitel}" öffnen`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rahmen text-primaer transition-colors hover:bg-primaer-soft"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {/* Vorher / Nachher */}
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                      <div className="rounded-lg border border-rahmen bg-flaeche-2 p-3">
                        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-leise">
                          Vorher
                        </p>
                        <p className="whitespace-pre-wrap text-base text-leise line-through">
                          {e.alterInhalt || '—'}
                        </p>
                      </div>
                      <div className="hidden items-center justify-center sm:flex">
                        <ArrowRight className="h-5 w-5 text-leise" aria-hidden="true" />
                      </div>
                      <div
                        className={`rounded-lg border p-3 ${
                          abgelehnt
                            ? 'border-einwand-rahmen/40 bg-einwand-bg'
                            : 'border-beschluss-rahmen/40 bg-beschluss-bg'
                        }`}
                      >
                        <p
                          className={`mb-1 text-sm font-semibold uppercase tracking-wide ${
                            abgelehnt ? 'text-einwand-text' : 'text-beschluss-text'
                          }`}
                        >
                          Nachher
                        </p>
                        <p
                          className={`whitespace-pre-wrap text-base ${
                            abgelehnt ? 'text-leise line-through' : 'text-text'
                          }`}
                        >
                          {e.neuerInhalt}
                        </p>
                        {abgelehnt && (
                          <p className="mt-1 text-sm font-medium text-einwand-text">
                            wird nicht übernommen
                          </p>
                        )}
                      </div>
                    </div>

                    {abgelehnt && e.ablehnungsgrund && (
                      <p className="mt-3 rounded-lg bg-einwand-bg/60 p-2 text-sm text-einwand-text">
                        <span className="font-semibold">Begründung der Ablehnung:</span>{' '}
                        {e.ablehnungsgrund}
                      </p>
                    )}

                    {/* Fußzeile: Antragsteller + entscheidender Admin, namentlich */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rahmen pt-3 text-sm text-leise">
                      <span>
                        Antrag von{' '}
                        <span className="font-semibold text-text">{e.beantragtVonName}</span>
                      </span>
                      <span>
                        {abgelehnt ? 'Abgelehnt' : 'Bestätigt'} von{' '}
                        <span className="font-semibold text-text">{e.bestaetigtVonName}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        offen={modalVorschlag !== null}
        titel=""
        onSchliessen={() => setModalVorschlag(null)}
        groesse="xl"
        eigenerKopf
      >
        {modalVorschlag && (
          <VorschlagFelder
            vorschlag={modalVorschlag}
            korrigierbar={korrigierbar}
            onAktualisiert={setModalVorschlag}
          />
        )}
      </Dialog>
    </div>
  );
}
