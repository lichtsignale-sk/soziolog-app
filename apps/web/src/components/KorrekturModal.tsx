import { useState } from 'react';
import { Info, PencilLine } from 'lucide-react';
import type { KorrekturZielTyp } from '@soziolog/shared';
import { apiFetch, ApiError } from '../lib/api-client';
import { useToast, Knopf, Dialog } from '@soziolog/ui';
import { EINTRAG, type EintragTyp } from '../lib/farben';

/** Punkt-Farbe je Typ für den Chip (leicht abgerundetes Quadrat). */
const PUNKT_BG: Record<EintragTyp, string> = {
  vorschlag: 'bg-vorschlag-rahmen',
  bedenken: 'bg-bedenken-rahmen',
  einwand: 'bg-einwand-rahmen',
  beschluss: 'bg-beschluss-rahmen',
};

const FELD_KLASSE =
  'w-full rounded-lg border border-rahmen bg-flaeche px-3 py-2 text-sm text-text placeholder:text-leise focus:border-primaer focus:outline-none';

/** Ein korrigierbares Feld eines Eintrags im Korrektur-Modal. */
export interface KorrekturFeld {
  feld: string;
  /** Feldname im Fließtext (z. B. „Wortlaut", „Integration"). */
  label: string;
  /** Überschrift des Read-only-Blocks (z. B. „Aktueller Wortlaut"). */
  aktuellLabel: string;
  /** Label des Eingabefelds (z. B. „Neuer Wortlaut"). */
  neuLabel: string;
  wert: string | null;
  /** Eingabeart: Fließtext (Standard) oder Kalendertag (für die Befristung). */
  inputTyp?: 'text' | 'datum';
}

/** Kontext für das Korrektur-Modal: welches Ziel, welche Felder. */
export interface KorrekturKontext {
  zielTyp: KorrekturZielTyp;
  zielId: string;
  chipTyp: EintragTyp;
  felder: KorrekturFeld[];
  /** Modal-Titel (Standard „Wortlaut ändern"; z. B. „Integration ergänzen"). */
  titel?: string;
}

/**
 * Eigenes Modal „Korrektur beantragen · Wortlaut ändern", das sich über dem
 * Vorschlag-Detail öffnet. Zeigt je korrigierbarem Feld den aktuellen Wortlaut
 * (read-only) und ein Eingabefeld; beim Absenden wird je verändertem Feld ein
 * Korrekturantrag gestellt (der Eintrag ändert sich erst nach Admin-Bestätigung).
 */
export function KorrekturModal({
  korrektur,
  onSchliessen,
}: {
  korrektur: KorrekturKontext;
  onSchliessen: () => void;
}) {
  const { zielTyp, zielId, chipTyp, felder, titel = 'Wortlaut ändern' } = korrektur;
  const toast = useToast();
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>(() =>
    Object.fromEntries(felder.map((f) => [f.feld, f.wert ?? ''])),
  );
  const [sendet, setSendet] = useState(false);

  const geaendert = felder.filter(
    (f) => (entwuerfe[f.feld] ?? '').trim() !== (f.wert ?? '').trim(),
  );

  async function stellen() {
    if (geaendert.length === 0) return;
    setSendet(true);
    try {
      for (const f of geaendert) {
        await apiFetch('/api/korrekturen', {
          method: 'POST',
          body: JSON.stringify({
            zielTyp,
            zielId,
            feld: f.feld,
            neuerInhalt: entwuerfe[f.feld] ?? '',
          }),
        });
      }
      toast.zeige('Korrektur beantragt. Ein Admin prüft die Änderung.');
      onSchliessen();
    } catch (e) {
      toast.zeige(e instanceof ApiError ? e.fehler.nachricht : 'Antrag fehlgeschlagen.', 'fehler');
    } finally {
      setSendet(false);
    }
  }

  const stil = EINTRAG[chipTyp];

  return (
    <Dialog
      offen
      titel={titel}
      onSchliessen={onSchliessen}
      groesse="lg"
      kopf={
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leise">
            Korrektur beantragen
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${stil.flaeche} ${stil.text}`}
            >
              <span className={`h-2 w-2 rounded-[3px] ${PUNKT_BG[chipTyp]}`} aria-hidden="true" />
              {stil.label}
            </span>
            <h2 className="font-serif text-2xl font-bold text-text">{titel}</h2>
          </div>
        </>
      }
      fussleiste={
        <>
          <Knopf variante="ghost" onClick={onSchliessen}>
            Abbrechen
          </Knopf>
          <Knopf laedt={sendet} disabled={geaendert.length === 0} onClick={stellen}>
            <PencilLine className="h-4 w-4" aria-hidden="true" />
            Korrekturantrag stellen
          </Knopf>
        </>
      }
    >
      <div className="space-y-5">
        {felder.map((f) => {
          const feldId = `korr-${zielTyp}-${zielId}-${f.feld}`;
          const istDatum = f.inputTyp === 'datum';
          return (
            <div key={f.feld}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-leise">
                {f.aktuellLabel}
              </p>
              <div className="rounded-lg border border-rahmen bg-flaeche-2 px-3 py-2 text-sm text-read">
                {f.wert?.trim() ? (
                  <span className="whitespace-pre-wrap">
                    {istDatum ? `Befristet bis ${f.wert}` : f.wert}
                  </span>
                ) : (
                  <span className="text-leise">
                    {istDatum ? 'Unbefristet' : `Noch keine ${f.label} hinterlegt`}
                  </span>
                )}
              </div>
              <label htmlFor={feldId} className="mb-1 mt-3 block text-sm font-medium text-text">
                {f.neuLabel}
              </label>
              {istDatum ? (
                <input
                  id={feldId}
                  type="date"
                  className={FELD_KLASSE}
                  value={entwuerfe[f.feld] ?? ''}
                  onChange={(e) => setEntwuerfe((v) => ({ ...v, [f.feld]: e.target.value }))}
                />
              ) : (
                <textarea
                  id={feldId}
                  rows={f.feld === 'titel' ? 2 : 4}
                  className={FELD_KLASSE}
                  value={entwuerfe[f.feld] ?? ''}
                  onChange={(e) => setEntwuerfe((v) => ({ ...v, [f.feld]: e.target.value }))}
                  placeholder={f.wert?.trim() ? undefined : `${f.label} eingeben …`}
                />
              )}
            </div>
          );
        })}
        <div className="flex items-start gap-2 rounded-lg border border-bedenken-rahmen/40 bg-bedenken-bg px-3 py-2.5 text-xs text-bedenken-text">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Diese Änderung wird als <span className="font-semibold">Korrekturantrag</span> eingereicht
            und muss von einem Admin bestätigt werden, bevor sie im Logbuch erscheint. Der ursprüngliche
            Wortlaut bleibt dauerhaft nachvollziehbar.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
