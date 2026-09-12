import { useState } from 'react';
import { Info } from 'lucide-react';
import { EINTRAG, type EintragTyp } from '../lib/farben';
import {
  Karte,
  Knopf,
  Abzeichen,
  EintragAbzeichen,
  Eingabefeld,
  DatumFeld,
  Dialog,
  Reiter,
  Tooltip,
  Tabelle,
  LeerZustand,
  Spinner,
  Skeleton,
  useToast,
} from '@soziolog/ui';

const TYPEN: EintragTyp[] = [
  'vorschlag',
  'bedenken',
  'einwand',
  'beschluss',
];

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b border-rahmen pb-1 text-lg font-semibold text-text">
        {titel}
      </h2>
      {children}
    </section>
  );
}

export function DesignSystemSeite() {
  const toast = useToast();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [datum, setDatum] = useState('');

  return (
    <div className="min-h-dvh bg-flaeche-2 px-4 py-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-primaer">SozioLog Design-System</h1>
        <p className="mb-8 text-sm text-leise">
          Tokens und Komponenten der grünen Markenidentität (nur helles Theme).
          Aktuelles Datum aus DatumFeld:{' '}
          <span className="ziffern-tabellarisch font-medium text-text">
            {datum || '—'}
          </span>
        </p>

        <Abschnitt titel="Eintragsfarben (Farbe + Label + Icon)">
          <p className="mb-3 text-sm text-leise">
            Farbe ist nie das alleinige Signal — jeder Typ trägt zusätzlich Label und Icon.
          </p>
          <div className="flex flex-wrap gap-2">
            {TYPEN.map((t) => (
              <EintragAbzeichen key={t} typ={t} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TYPEN.map((t) => {
              const s = EINTRAG[t];
              return (
                <div key={t} className={`rounded-lg border p-3 ${s.flaeche} ${s.rahmen} ${s.text}`}>
                  <EintragAbzeichen typ={t} />
                  <p className="mt-2 text-sm">Beispieltext im Eintrag „{s.label}".</p>
                </div>
              );
            })}
          </div>
        </Abschnitt>

        <Abschnitt titel="Farbtokens (Oberflächen)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['flaeche', 'bg-flaeche'],
              ['flaeche-2', 'bg-flaeche-2'],
              ['flaeche-3', 'bg-flaeche-3'],
              ['primaer', 'bg-primaer'],
            ].map(([name, klasse]) => (
              <div key={name} className="overflow-hidden rounded-lg border border-rahmen">
                <div className={`h-12 ${klasse}`} />
                <div className="px-2 py-1 text-xs text-leise">{name}</div>
              </div>
            ))}
          </div>
        </Abschnitt>

        <Abschnitt titel="Typografie">
          <div className="space-y-1">
            <p className="text-3xl font-bold text-text">Überschrift 32</p>
            <p className="text-2xl font-bold text-text">Überschrift 24</p>
            <p className="text-lg font-semibold text-text">Titel 18</p>
            <p className="text-base text-text">Fließtext 16 — der Standard.</p>
            <p className="text-sm text-leise">Klein 14 (leise)</p>
            <p className="ziffern-tabellarisch text-sm text-text">
              Tabellenziffern: 2026-07-04 · 1.234
            </p>
          </div>
        </Abschnitt>

        <Abschnitt titel="Knöpfe">
          <div className="flex flex-wrap items-center gap-3">
            <Knopf>Primär</Knopf>
            <Knopf variante="sekundaer">Sekundär</Knopf>
            <Knopf variante="gefahr">Gefahr</Knopf>
            <Knopf variante="ghost">Ghost</Knopf>
            <Knopf laedt>Lädt</Knopf>
            <Knopf disabled>Deaktiviert</Knopf>
          </div>
        </Abschnitt>

        <Abschnitt titel="Statuspillen & Karte">
          <div className="mb-3 flex gap-2">
            <Abzeichen className="bg-vorschlag-bg text-vorschlag-text">Offen</Abzeichen>
            <Abzeichen className="bg-beschluss-bg text-beschluss-text">Entschieden</Abzeichen>
          </div>
          <Karte className="p-4">
            <p className="text-text">Eine Karte-Fläche.</p>
          </Karte>
        </Abschnitt>

        <Abschnitt titel="Formularfelder">
          <div className="max-w-sm">
            <Eingabefeld label="Textfeld" placeholder="Eingabe …" helfertext="Ein Helfertext." />
            <DatumFeld
              label="DatumFeld (nur Kalendertag)"
              value={datum}
              onChange={setDatum}
              helfertext="Liefert ausschließlich YYYY-MM-DD."
            />
          </div>
        </Abschnitt>

        <Abschnitt titel="Overlays & Rückmeldung">
          <div className="flex flex-wrap gap-3">
            <Knopf onClick={() => setDialogOffen(true)}>Dialog öffnen</Knopf>
            <Knopf variante="sekundaer" onClick={() => toast.zeige('Gespeichert.')}>
              Toast (Erfolg)
            </Knopf>
            <Knopf variante="sekundaer" onClick={() => toast.zeige('Etwas ging schief.', 'fehler')}>
              Toast (Fehler)
            </Knopf>
            <Tooltip text="Ich erscheine bei Hover und Fokus.">
              <span className="inline-flex items-center gap-1 text-sm text-primaer">
                <Info className="h-4 w-4" aria-hidden="true" /> Tooltip
              </span>
            </Tooltip>
          </div>
          <Dialog
            offen={dialogOffen}
            titel="Beispiel-Dialog"
            onSchliessen={() => setDialogOffen(false)}
            fussleiste={
              <>
                <Knopf variante="sekundaer" onClick={() => setDialogOffen(false)}>
                  Abbrechen
                </Knopf>
                <Knopf onClick={() => setDialogOffen(false)}>Bestätigen</Knopf>
              </>
            }
          >
            Mit Fokusfalle, Esc zum Schließen und Hintergrund-Scrim.
          </Dialog>
        </Abschnitt>

        <Abschnitt titel="Reiter">
          <Reiter
            eintraege={[
              { schluessel: 'a', titel: 'Verlauf', inhalt: <p className="text-text">Inhalt A</p> },
              { schluessel: 'b', titel: 'Stichtag', inhalt: <p className="text-text">Inhalt B</p> },
            ]}
          />
        </Abschnitt>

        <Abschnitt titel="Tabelle">
          <Tabelle spalten={['Domäne', 'Beschlüsse']} beschriftung="Beispiel">
            <tr>
              <td className="px-4 py-2">Kernkreis</td>
              <td className="ziffern-tabellarisch px-4 py-2">3</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Finanzen</td>
              <td className="ziffern-tabellarisch px-4 py-2">1</td>
            </tr>
          </Tabelle>
        </Abschnitt>

        <Abschnitt titel="Leer- & Ladezustände">
          <div className="grid gap-4 sm:grid-cols-2">
            <LeerZustand titel="Nichts vorhanden" hinweis="Ein einheitlicher Leerzustand." />
            <Karte className="p-4">
              <Spinner />
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Karte>
          </div>
        </Abschnitt>
      </div>
    </div>
  );
}
