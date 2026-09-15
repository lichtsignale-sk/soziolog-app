import { useEffect, useId, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { Dialog, Knopf } from '@soziolog/ui';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api-client';
import { seitenBezeichnung, seitenPfad } from '../lib/seiten';

/** Dieselbe Grenze wie serverseitig (FeedbackDto). */
export const FEEDBACK_TEXT_MAX = 5000;
/** Ab hier zeigt das Feld, wie viel noch geht. */
const ZAEHLER_AB = FEEDBACK_TEXT_MAX - 500;

export const FEEDBACK_FRAGE =
  'Was können wir an der App aus deiner Sicht noch verbessern?';
export const FEEDBACK_ERKLAERUNG =
  'Bitte beschreibe uns in deinen Worten, womit du Schwierigkeiten oder Probleme ' +
  'hattest oder welche Verbesserung du an welcher Stelle empfiehlst.';
export const FEEDBACK_DANK =
  'Vielen Dank für dein Feedback zu SozioLog. Das hilft uns, die App noch besser ' +
  'zu machen und auf die echten Bedürfnisse von soziokratischen Organisationen ' +
  'anzupassen.';

/** Wie der Server, falls er keine Bezeichnung mitschickt. */
const EMPFAENGER_VORGABE = 'das Team, das diese Instanz betreut';

const FELD_KLASSE =
  'w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-base text-text ' +
  'placeholder:text-leise focus:border-primaer focus:outline-none';

/**
 * Feedback zur App — öffnet sich über der Seite, auf der man gerade ist.
 *
 * Nach dem Senden bleibt der Dialog offen und bedankt sich; erst „Schließen"
 * setzt ihn zurück. Wer vorher abbricht, behält seinen Entwurf bis zum
 * nächsten Öffnen.
 */
export function FeedbackModal({
  offen,
  empfaengerName = EMPFAENGER_VORGABE,
  onSchliessen,
  onNichtVerfuegbar,
}: {
  offen: boolean;
  /** Vom Server (`/api/feedback/status`), z. B. „das Team, das diese Instanz betreut". */
  empfaengerName?: string;
  onSchliessen: () => void;
  /** Der Server meldet das Modul als abgeschaltet (404). */
  onNichtVerfuegbar?: () => void;
}) {
  const { person, demoModus } = useAuth();
  const { pathname } = useLocation();
  const formId = useId();
  const feldId = useId();
  const erklaerungId = useId();
  const zaehlerId = useId();
  const schliessenId = useId();

  const [gesendet, setGesendet] = useState(false);
  const [text, setText] = useState('');
  const [rueckfragen, setRueckfragen] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Der Senden-Knopf verschwindet mit dem Dank; der Fokus soll nicht ins
  // Leere fallen, sondern auf „Schließen". `autoFocus` genügt dafür nicht:
  // Der Dialog bleibt derselbe, nur sein Inhalt wechselt.
  useEffect(() => {
    if (gesendet) document.getElementById(schliessenId)?.focus();
  }, [gesendet, schliessenId]);

  function schliessen() {
    if (gesendet) {
      setGesendet(false);
      setText('');
      setRueckfragen(false);
    }
    setFehler(null);
    onSchliessen();
  }

  async function senden(e: FormEvent) {
    e.preventDefault();
    const inhalt = text.trim();
    if (!inhalt || sendet) return;
    setSendet(true);
    setFehler(null);
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        // Der Fehler steht im Dialog selbst — kein zweiter als Toast.
        stumm: true,
        body: JSON.stringify({
          text: inhalt,
          seite: seitenPfad(pathname),
          seitenBezeichnung: seitenBezeichnung(pathname),
          rueckfragenErlaubt: !demoModus && rueckfragen,
        }),
      });
      setGesendet(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setFehler('Feedback ist gerade nicht verfügbar.');
        onNichtVerfuegbar?.();
      } else if (err instanceof ApiError && err.status === 429) {
        setFehler(
          'Du hast gerade schon mehrfach Feedback geschickt. Bitte warte ein paar ' +
            'Minuten und versuche es dann noch einmal. Dein Text bleibt hier stehen.',
        );
      } else {
        setFehler(
          err instanceof ApiError
            ? err.fehler.nachricht
            : 'Das Senden hat nicht geklappt. Bitte versuche es noch einmal.',
        );
      }
    } finally {
      setSendet(false);
    }
  }

  const leer = text.trim().length === 0;
  const rest = FEEDBACK_TEXT_MAX - text.length;

  if (gesendet) {
    return (
      <Dialog
        offen={offen}
        eyebrow="Feedback"
        titel="Danke!"
        groesse="lg"
        onSchliessen={schliessen}
        fussleiste={
          // Eigener `key`: Sonst übernimmt React den (durchsichtigen)
          // Abbrechen-Knopf und blendet ihn sichtbar zu Grün über.
          <Knopf key="dank-schliessen" id={schliessenId} onClick={schliessen}>
            Schließen
          </Knopf>
        }
      >
        <div role="status" className="flex items-start gap-4">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primaer-soft text-primaer"
            aria-hidden="true"
          >
            <HeartHandshake className="h-6 w-6" />
          </span>
          <p className="fliesstext text-base text-text">{FEEDBACK_DANK}</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      offen={offen}
      eyebrow="Feedback"
      titel={FEEDBACK_FRAGE}
      groesse="lg"
      onSchliessen={schliessen}
      fussleiste={
        <>
          <Knopf type="button" variante="ghost" onClick={schliessen}>
            Abbrechen
          </Knopf>
          <Knopf type="submit" form={formId} disabled={leer} laedt={sendet}>
            Feedback senden
          </Knopf>
        </>
      }
    >
      <form id={formId} onSubmit={senden} noValidate>
        <p id={erklaerungId} className="mb-4 text-base text-leise">
          {FEEDBACK_ERKLAERUNG}
        </p>

        <label htmlFor={feldId} className="mb-1 block text-sm font-medium text-text">
          Dein Feedback
        </label>
        <textarea
          id={feldId}
          rows={6}
          maxLength={FEEDBACK_TEXT_MAX}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby={
            text.length >= ZAEHLER_AB ? `${erklaerungId} ${zaehlerId}` : erklaerungId
          }
          placeholder="Zum Beispiel: Auf der Seite … habe ich … gesucht und nicht gefunden."
          className={`${FELD_KLASSE} min-h-36 resize-y`}
        />
        <div aria-live="polite" className="mt-1 min-h-5 text-right text-xs text-leise">
          {text.length >= ZAEHLER_AB && (
            <span id={zaehlerId}>Noch {rest} Zeichen</span>
          )}
        </div>

        {!demoModus && person && (
          <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={rueckfragen}
              onChange={(e) => setRueckfragen(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primaer"
            />
            <span>
              Ihr dürft mich für Rückfragen kontaktieren.
              <span className="block text-xs text-leise">
                Dann schicken wir deinen Namen und deine E-Mail-Adresse (
                {person.loginEmail}) mit.
              </span>
            </span>
          </label>
        )}

        <p className="mt-4 text-xs text-leise">
          Dein Feedback geht direkt an {empfaengerName}. Mitgeschickt{' '}
          {demoModus
            ? 'wird nur die Seite, auf der du gerade bist.'
            : 'werden deine Organisation und die Seite, auf der du gerade bist.'}
        </p>

        {fehler && (
          <p role="alert" className="mt-3 text-sm text-gefahr">
            {fehler}
          </p>
        )}
      </form>
    </Dialog>
  );
}
