import { useState } from 'react';
import { apiFetch, ApiError } from '../lib/api-client';
import { Dialog, Knopf, Schalter, Eingabefeld, useToast } from '@soziolog/ui';

/**
 * Zeile „Zwei-Faktor-Authentifizierung" mit grünem Kippschalter (E-Mail-2FA).
 * Einschalten aktiviert direkt und zeigt einen Hinweis-Dialog; beim nächsten
 * Login wird dann ein 6-stelliger Code per E-Mail abgefragt. Ausschalten
 * verlangt zur Sicherheit das aktuelle Passwort. Kein Authenticator/QR.
 */
export function ZweiFaktorSchalter({
  aktiv,
  onGeaendert,
}: {
  aktiv: boolean;
  onGeaendert: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [laedt, setLaedt] = useState(false);
  const [ausschaltenOffen, setAusschaltenOffen] = useState(false);
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [passwort, setPasswort] = useState('');

  async function einschalten() {
    setLaedt(true);
    try {
      await apiFetch('/api/konto/2fa/einschalten', { method: 'POST' });
      await onGeaendert();
      setHinweisOffen(true);
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Aktivieren fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setLaedt(false);
    }
  }

  async function ausschalten() {
    setLaedt(true);
    try {
      await apiFetch('/api/konto/2fa/ausschalten', {
        method: 'POST',
        body: JSON.stringify({ aktuellesPasswort: passwort }),
      });
      toast.zeige('Zusätzliche Bestätigung deaktiviert.');
      setAusschaltenOffen(false);
      setPasswort('');
      await onGeaendert();
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Deaktivieren fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setLaedt(false);
    }
  }

  function umschalten() {
    if (aktiv) setAusschaltenOffen(true);
    else void einschalten();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text">Zwei-Faktor-Authentifizierung</p>
          <p className="text-xs text-leise">Zusätzliche Bestätigung beim Anmelden</p>
        </div>
        <Schalter
          an={aktiv}
          onUmschalten={umschalten}
          disabled={laedt}
          label="Zwei-Faktor-Authentifizierung"
        />
      </div>

      {/* Hinweis nach dem Einschalten. */}
      <Dialog
        offen={hinweisOffen}
        titel="Zwei-Faktor-Authentifizierung aktiviert"
        onSchliessen={() => setHinweisOffen(false)}
        fussleiste={
          <div className="flex justify-end">
            <Knopf onClick={() => setHinweisOffen(false)}>Verstanden</Knopf>
          </div>
        }
      >
        <p className="text-sm text-text">
          Ab dem nächsten Login schicken wir dir nach dem Passwort einen
          6-stelligen Bestätigungscode an deine E-Mail-Adresse.
        </p>
      </Dialog>

      {/* Ausschalten verlangt das aktuelle Passwort. */}
      <Dialog
        offen={ausschaltenOffen}
        titel="Zusätzliche Bestätigung ausschalten"
        onSchliessen={() => setAusschaltenOffen(false)}
        fussleiste={
          <div className="flex justify-end gap-2">
            <Knopf variante="ghost" onClick={() => setAusschaltenOffen(false)}>
              Abbrechen
            </Knopf>
            <Knopf
              variante="gefahr"
              disabled={!passwort}
              laedt={laedt}
              onClick={ausschalten}
            >
              Ausschalten
            </Knopf>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-leise">
            Bitte bestätige mit deinem aktuellen Passwort. Danach ist beim Login
            kein E-Mail-Code mehr nötig.
          </p>
          <Eingabefeld
            label="Aktuelles Passwort"
            type="password"
            autoComplete="current-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
        </div>
      </Dialog>
    </>
  );
}
