import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api-client';
import { Dialog, Knopf, Eingabefeld, useToast } from '@soziolog/ui';

/** Erfüllte Anforderung als Chip (grün mit Haken / grau mit Kreuz). */
function AnforderungsChip({ erfuellt, text }: { erfuellt: boolean; text: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
        erfuellt ? 'bg-beschluss-bg text-beschluss-text' : 'bg-flaeche-3 text-leise'
      }`}
    >
      {erfuellt ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      {text}
    </span>
  );
}

const STAERKE_LABEL = ['Schwach', 'Schwach', 'Gut', 'Stark'];
const STAERKE_KLASSE = ['bg-einwand-rahmen', 'bg-einwand-rahmen', 'bg-bedenken-rahmen', 'bg-beschluss-rahmen'];

/** Grobe Stärke 0–3 aus Länge + Zeichenvielfalt. */
function staerke(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++;
  return Math.min(s, 3);
}

export function PasswortAendernModal({
  offen,
  onSchliessen,
}: {
  offen: boolean;
  onSchliessen: () => void;
}) {
  const toast = useToast();
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [wdh, setWdh] = useState('');
  const [sendet, setSendet] = useState(false);

  const langGenug = neu.length >= 8;
  const buchstabeZahl = /[a-zA-Z]/.test(neu) && /\d/.test(neu);
  const stimmtUeberein = neu.length > 0 && neu === wdh;
  const gueltig = alt.length > 0 && langGenug && buchstabeZahl && stimmtUeberein;
  const s = staerke(neu);

  function schliessen() {
    setAlt('');
    setNeu('');
    setWdh('');
    onSchliessen();
  }

  async function speichern() {
    if (!gueltig) return;
    setSendet(true);
    try {
      await apiFetch('/api/konto/passwort', {
        method: 'POST',
        body: JSON.stringify({ altesPasswort: alt, neuesPasswort: neu }),
      });
      toast.zeige('Passwort geändert.');
      schliessen();
    } catch (e) {
      toast.zeige(
        e instanceof ApiError ? e.fehler.nachricht : 'Ändern fehlgeschlagen.',
        'fehler',
      );
    } finally {
      setSendet(false);
    }
  }

  return (
    <Dialog
      offen={offen}
      eyebrow="Sicherheit"
      titel="Passwort ändern"
      onSchliessen={schliessen}
      fussleiste={
        <div className="flex justify-end gap-2">
          <Knopf variante="ghost" onClick={schliessen}>
            Abbrechen
          </Knopf>
          <Knopf disabled={!gueltig} laedt={sendet} onClick={speichern}>
            Passwort ändern
          </Knopf>
        </div>
      }
    >
      <div className="space-y-3">
        <Eingabefeld
          label="Aktuelles Passwort"
          type="password"
          autoComplete="current-password"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
        />
        <div>
          <Eingabefeld
            label="Neues Passwort"
            type="password"
            autoComplete="new-password"
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
          />
          {neu.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < s ? STAERKE_KLASSE[s] : 'bg-flaeche-3'}`}
                  />
                ))}
              </div>
              <span className="mt-1 block text-xs text-leise">Stärke: {STAERKE_LABEL[s]}</span>
            </div>
          )}
        </div>
        <Eingabefeld
          label="Neues Passwort bestätigen"
          type="password"
          autoComplete="new-password"
          value={wdh}
          onChange={(e) => setWdh(e.target.value)}
          fehler={wdh.length > 0 && !stimmtUeberein ? 'Die Passwörter stimmen nicht überein.' : undefined}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <AnforderungsChip erfuellt={langGenug} text="8+ Zeichen" />
          <AnforderungsChip erfuellt={buchstabeZahl} text="Buchstabe & Zahl" />
          <AnforderungsChip erfuellt={stimmtUeberein} text="Stimmt überein" />
        </div>
      </div>
    </Dialog>
  );
}
