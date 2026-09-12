import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, Replace, Square } from 'lucide-react';
import type { BeschlussDTO } from '@soziolog/shared';
import { heute } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { useToast, Knopf, DatumFeld } from '@soziolog/ui';

type Wahl = 'bestaetigen' | 'ersetzen' | 'beenden';

const WAHL_BASIS =
  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors';
const WAHL_AKTIV = 'border-primaer bg-primaer-soft text-primaer-softtext';
const WAHL_INAKTIV = 'border-rahmen bg-flaeche text-text hover:bg-flaeche-3';

/**
 * Handlungsleiste am Fristende eines befristeten Beschlusses (nur für
 * Protokollführung/Admin, wenn der Beschluss in Überprüfung ist): erneut
 * bestätigen (derselbe Beschluss), durch neuen Beschluss ersetzen (Neufassung)
 * oder beenden.
 */
export function BeschlussLebenszyklus({
  beschluss,
  domaeneId,
  onErledigt,
}: {
  beschluss: BeschlussDTO;
  domaeneId: string;
  onErledigt: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [wahl, setWahl] = useState<Wahl>('bestaetigen');
  const [befristet, setBefristet] = useState(false);
  const [datum, setDatum] = useState('');
  const [sendet, setSendet] = useState(false);

  async function bestaetigen() {
    if (befristet && !datum) {
      toast.zeige('Bei einer Befristung ist das Überprüfungsdatum Pflicht.', 'fehler');
      return;
    }
    setSendet(true);
    try {
      await apiFetch(`/api/beschluesse/${beschluss.id}/bestaetigen`, {
        method: 'POST',
        body: JSON.stringify({
          befristung: befristet ? 'befristet' : 'unbefristet',
          ueberpruefungsdatum: befristet ? datum : undefined,
        }),
      });
      toast.zeige('Beschluss erneut bestätigt.');
      onErledigt();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Bestätigen fehlgeschlagen.', 'fehler');
    } finally {
      setSendet(false);
    }
  }

  async function beenden() {
    if (!window.confirm('Diesen Beschluss ohne Nachfolger beenden? Er gilt danach nicht mehr.')) {
      return;
    }
    setSendet(true);
    try {
      await apiFetch(`/api/beschluesse/${beschluss.id}/beenden`, { method: 'POST' });
      toast.zeige('Beschluss beendet.');
      onErledigt();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Beenden fehlgeschlagen.', 'fehler');
    } finally {
      setSendet(false);
    }
  }

  function ersetzen() {
    // Neufassung im Domänen-Log anlegen (Deep-Link öffnet das passende Formular).
    navigate(`/domaenen/${domaeneId}?neufassung=${beschluss.id}`);
  }

  function uebernehmen() {
    if (wahl === 'bestaetigen') return bestaetigen();
    if (wahl === 'beenden') return beenden();
    return ersetzen();
  }

  return (
    <div className="rounded-xl border border-bedenken-rahmen/50 bg-bedenken-bg/50 p-4">
      <p className="mb-3 flex items-start gap-2 text-sm font-medium text-bedenken-text">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Die Frist dieses Beschlusses ist erreicht. Was soll künftig gelten?</span>
      </p>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setWahl('bestaetigen')}
          aria-pressed={wahl === 'bestaetigen'}
          className={`${WAHL_BASIS} ${wahl === 'bestaetigen' ? WAHL_AKTIV : WAHL_INAKTIV}`}
        >
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Erneut bestätigen</span>
            <span className="block text-xs opacity-80">
              Derselbe Beschluss gilt weiter – befristet oder unbefristet.
            </span>
          </span>
        </button>

        {wahl === 'bestaetigen' && (
          <div className="ml-7 space-y-3 rounded-lg border border-rahmen bg-flaeche p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { wert: false, label: 'Unbefristet' },
                { wert: true, label: 'Befristet' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setBefristet(o.wert)}
                  aria-pressed={befristet === o.wert}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    befristet === o.wert ? WAHL_AKTIV : WAHL_INAKTIV
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {befristet && (
              <DatumFeld
                label="Neues Überprüfungsdatum"
                value={datum}
                min={heute()}
                onChange={setDatum}
              />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setWahl('ersetzen')}
          aria-pressed={wahl === 'ersetzen'}
          className={`${WAHL_BASIS} ${wahl === 'ersetzen' ? WAHL_AKTIV : WAHL_INAKTIV}`}
        >
          <Replace className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Durch neuen Beschluss ersetzen</span>
            <span className="block text-xs opacity-80">
              Legt eine Neufassung an – mit eigenen Bedenken und Einwänden.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setWahl('beenden')}
          aria-pressed={wahl === 'beenden'}
          className={`${WAHL_BASIS} ${wahl === 'beenden' ? WAHL_AKTIV : WAHL_INAKTIV}`}
        >
          <Square className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Beschluss beenden</span>
            <span className="block text-xs opacity-80">
              Der Beschluss gilt ab heute nicht mehr – ohne Nachfolger.
            </span>
          </span>
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <Knopf laedt={sendet} onClick={uebernehmen}>
          {wahl === 'ersetzen' ? 'Neufassung anlegen' : 'Übernehmen'}
        </Knopf>
      </div>
    </div>
  );
}
