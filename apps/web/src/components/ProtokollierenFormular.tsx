import { useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api-client';
import { useToast, Knopf, Eingabefeld, DatumFeld } from '@soziolog/ui';

type Art = 'bedenken' | 'einwand' | 'beschluss';

const FELD_KLASSE =
  'w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-text placeholder:text-leise focus:border-primaer focus:outline-none';

/** Art-Auswahl: aktiver Button in der jeweiligen Typfarbe umrandet. */
const ARTEN: { wert: Art; label: string; aktiv: string }[] = [
  { wert: 'bedenken', label: 'Bedenken', aktiv: 'border-bedenken-rahmen bg-bedenken-bg text-bedenken-text' },
  { wert: 'einwand', label: 'Einwand', aktiv: 'border-einwand-rahmen bg-einwand-bg text-einwand-text' },
  { wert: 'beschluss', label: 'Beschluss', aktiv: 'border-beschluss-rahmen bg-beschluss-bg text-beschluss-text' },
];

const INHALT_LABEL: Record<Art, string> = {
  bedenken: 'Inhalt des Bedenkens',
  einwand: 'Inhalt des Einwands',
  beschluss: 'Inhalt des Beschlusses',
};
const INHALT_PLATZHALTER: Record<Art, string> = {
  bedenken: 'Nicht blockierender Hinweis…',
  einwand: 'Blockierender Widerspruch…',
  beschluss: 'Was wurde beschlossen?',
};

const WAHL_INAKTIV = 'border-rahmen bg-flaeche text-text hover:bg-flaeche-3';
const WAHL_BASIS =
  'cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors';

/**
 * Eingebetteter Protokollieren-Bereich im Vorschlag-Detail-Modal: immer nur
 * eine Art (Bedenken/Einwand/Beschluss) gleichzeitig, ersetzt die früheren
 * drei parallelen Karten der eigenständigen Protokoll-Seite.
 */
export function ProtokollierenFormular({
  vorschlagId,
  beschlussGesperrt,
  onGespeichert,
  onAbbrechen,
}: {
  vorschlagId: string;
  beschlussGesperrt: boolean;
  onGespeichert: () => void;
  onAbbrechen: () => void;
}) {
  const toast = useToast();
  const [art, setArt] = useState<Art>('bedenken');
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [bedenkenInhalt, setBedenkenInhalt] = useState('');
  const [einwandInhalt, setEinwandInhalt] = useState('');
  const [schweregrad, setSchweregrad] = useState<'leicht' | 'schwerwiegend'>('leicht');
  const [integration, setIntegration] = useState('');
  const [beschlussInhalt, setBeschlussInhalt] = useState('');
  const [notiz, setNotiz] = useState('');
  const [befristung, setBefristung] = useState<'unbefristet' | 'befristet'>('unbefristet');
  const [ueberpruefungsdatum, setUeberpruefungsdatum] = useState('');

  const integrationPflicht = schweregrad === 'schwerwiegend';

  async function speichern() {
    setFehler(null);

    if (art === 'bedenken' && !bedenkenInhalt.trim()) {
      setFehler('Inhalt ist ein Pflichtfeld.');
      return;
    }
    if (art === 'einwand') {
      if (!einwandInhalt.trim()) {
        setFehler('Inhalt ist ein Pflichtfeld.');
        return;
      }
      if (integrationPflicht && !integration.trim()) {
        setFehler('Bei einem schwerwiegenden Einwand ist die Integration Pflicht.');
        return;
      }
    }
    if (art === 'beschluss') {
      if (beschlussGesperrt) {
        setFehler(
          'Erst wenn alle schwerwiegenden Einwände eine Integration haben, kann ein Beschluss gefasst werden.',
        );
        return;
      }
      if (!beschlussInhalt.trim()) {
        setFehler('Beschlusstext ist ein Pflichtfeld.');
        return;
      }
      if (befristung === 'befristet' && !ueberpruefungsdatum) {
        setFehler('Bei einer Befristung ist das Überprüfungsdatum Pflicht.');
        return;
      }
    }

    const [pfad, body] =
      art === 'bedenken'
        ? [`/api/vorschlaege/${vorschlagId}/bedenken`, { inhalt: bedenkenInhalt }]
        : art === 'einwand'
          ? [
              `/api/vorschlaege/${vorschlagId}/einwaende`,
              {
                inhalt: einwandInhalt,
                schweregrad,
                integration: integration.trim() || undefined,
              },
            ]
          : [
              `/api/vorschlaege/${vorschlagId}/beschluss`,
              {
                inhalt: beschlussInhalt,
                notiz: notiz.trim() || undefined,
                befristung,
                ueberpruefungsdatum: befristung === 'befristet' ? ueberpruefungsdatum : undefined,
              },
            ];

    setSendet(true);
    try {
      await apiFetch(pfad as string, { method: 'POST', body: JSON.stringify(body) });
      toast.zeige('Gespeichert.');
      onGespeichert();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Speichern fehlgeschlagen.', 'fehler');
    } finally {
      setSendet(false);
    }
  }

  const inhalt = art === 'bedenken' ? bedenkenInhalt : art === 'einwand' ? einwandInhalt : beschlussInhalt;
  const setInhalt =
    art === 'bedenken' ? setBedenkenInhalt : art === 'einwand' ? setEinwandInhalt : setBeschlussInhalt;

  return (
    <div className="rounded-xl border border-rahmen bg-flaeche-2 p-4 text-left">
      {/* Kopf: Titel + Schließen */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-text">Protokollieren</h3>
        <button
          type="button"
          onClick={onAbbrechen}
          aria-label="Schließen"
          className="shrink-0 rounded-md p-1 text-leise hover:bg-flaeche-3"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Art-Auswahl */}
      <div className="mb-4">
        <p className="mb-1.5 text-sm font-medium text-text">Was möchtest du protokollieren?</p>
        <div className="grid grid-cols-3 gap-3">
          {ARTEN.map((a) => (
            <button
              key={a.wert}
              type="button"
              onClick={() => {
                setArt(a.wert);
                setFehler(null);
              }}
              aria-pressed={art === a.wert}
              className={`${WAHL_BASIS} ${art === a.wert ? a.aktiv : WAHL_INAKTIV}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inhalt (dynamisch je Art) */}
      <div className="mb-4">
        <label htmlFor="protokoll-inhalt" className="mb-1 block text-sm font-medium text-text">
          {INHALT_LABEL[art]}
        </label>
        <textarea
          id="protokoll-inhalt"
          rows={3}
          className={FELD_KLASSE}
          placeholder={INHALT_PLATZHALTER[art]}
          value={inhalt}
          onChange={(e) => setInhalt(e.target.value)}
        />
      </div>

      {art === 'einwand' && (
        <>
          <div className="mb-4">
            <p className="mb-1.5 text-sm font-medium text-text">Schweregrad</p>
            <div className="grid grid-cols-2 gap-3">
              {(['leicht', 'schwerwiegend'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSchweregrad(s)}
                  aria-pressed={schweregrad === s}
                  className={`${WAHL_BASIS} ${
                    schweregrad === s
                      ? 'border-einwand-rahmen bg-einwand-bg text-einwand-text'
                      : WAHL_INAKTIV
                  }`}
                >
                  {s === 'leicht' ? 'Leicht' : 'Schwerwiegend'}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="protokoll-integration" className="mb-1 block text-sm font-medium text-text">
              Integration {integrationPflicht ? '(Pflicht)' : '(optional)'}
            </label>
            <textarea
              id="protokoll-integration"
              rows={2}
              className={FELD_KLASSE}
              placeholder="Wie wird der Einwand aufgelöst?"
              value={integration}
              onChange={(e) => setIntegration(e.target.value)}
            />
          </div>
        </>
      )}

      {art === 'beschluss' && (
        <>
          <Eingabefeld label="Notiz (optional)" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
          <fieldset className="mb-4">
            <legend className="mb-1.5 block text-sm font-medium text-text">Befristung</legend>
            <div className="grid grid-cols-2 gap-3">
              {(['unbefristet', 'befristet'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBefristung(b)}
                  aria-pressed={befristung === b}
                  className={`${WAHL_BASIS} ${
                    befristung === b
                      ? 'border-primaer bg-primaer-soft text-primaer-softtext'
                      : WAHL_INAKTIV
                  }`}
                >
                  {b === 'unbefristet' ? 'Unbefristet' : 'Befristet'}
                </button>
              ))}
            </div>
          </fieldset>
          {befristung === 'befristet' && (
            <DatumFeld
              label="Überprüfungsdatum"
              value={ueberpruefungsdatum}
              onChange={setUeberpruefungsdatum}
            />
          )}
          {beschlussGesperrt && (
            <p className="mb-4 text-sm text-einwand-text">
              Erst wenn alle schwerwiegenden Einwände eine Integration haben, kann ein Beschluss
              gefasst werden.
            </p>
          )}
        </>
      )}

      {fehler && (
        <p className="mb-4 text-sm text-gefahr" role="alert">
          {fehler}
        </p>
      )}

      <div className="flex justify-end">
        <Knopf laedt={sendet} onClick={speichern}>
          Speichern
        </Knopf>
      </div>
    </div>
  );
}
