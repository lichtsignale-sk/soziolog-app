import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Modaler Dialog: Scrim, Esc/Hintergrundklick schließt, Fokus wandert in den
 * Dialog und wird darin gehalten (einfache Fokusfalle), role=dialog + aria-modal.
 */
const GROESSE_KLASSE = {
  sm: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
} as const;

/**
 * Stapel offener Dialoge (LIFO). Nur der oberste reagiert auf Escape/Tab, damit
 * bei gestapelten Modals (z. B. Korrektur über Vorschlag-Detail) Escape nicht
 * beide gleichzeitig schließt.
 */
const dialogStapel: string[] = [];

export function Dialog({
  offen,
  titel,
  eyebrow,
  kopf,
  onSchliessen,
  children,
  fussleiste,
  groesse = 'sm',
  eigenerKopf = false,
}: {
  offen: boolean;
  titel: string;
  /** Kleines Label über dem Titel; macht den Titel zum Serifen-Großtitel. */
  eyebrow?: string;
  /** Ersetzt den eingebauten Eyebrow/Titel-Block (X + Padding bleiben). */
  kopf?: ReactNode;
  onSchliessen: () => void;
  children: ReactNode;
  /** Buttons unten: erscheinen immer als graue Bande mit Trennlinie (einheitlich). */
  fussleiste?: ReactNode;
  groesse?: 'sm' | 'lg' | 'xl';
  /**
   * Der Inhalt bringt seinen eigenen Kopf mit (z. B. das Vorschlag-Detail): die
   * eingebaute Titelzeile entfällt, das Schließen-X schwebt oben rechts und der
   * Panel bekommt einen durchgehenden blauen Top-Rand.
   */
  eigenerKopf?: boolean;
}) {
  const titelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const vorherFokus = useRef<HTMLElement | null>(null);
  const warOffen = useRef(false);

  /**
   * DEN AUSLÖSER BEIM ÖFFNEN MERKEN — IM RENDERN, NICHT IM EFFEKT.
   *
   * React wertet `autoFocus` im Commit aus, also VOR dem Effekt unten. Hat der
   * Inhalt ein Feld mit `autoFocus`, stünde dort sonst schon dieses Feld als
   * „vorher fokussiert" — und beim Schließen ginge der Fokus an ein Element,
   * das es dann nicht mehr gibt: er landete auf <body>. Im Rendern ist der
   * Auslöser noch der aktive Knopf. Nur beim Übergang zu/offen, damit ein
   * erneutes Rendern bei offenem Dialog nichts überschreibt.
   */
  if (offen && !warOffen.current && typeof document !== 'undefined') {
    vorherFokus.current = document.activeElement as HTMLElement | null;
  }
  warOffen.current = offen;

  /**
   * DER SCHLIESSEN-RUF LIEGT IN EINER REF, UND DAS IST DER GANZE PUNKT.
   *
   * Vorher stand `onSchliessen` in der Abhängigkeitsliste des Effekts. Fast
   * alle Aufrufer übergeben dort eine Pfeilfunktion oder eine im Rumpf
   * definierte Funktion — beides ist bei JEDEM Rendern eine neue Identität.
   * Also lief der Effekt nach jedem Tastendruck in einem Eingabefeld erneut:
   * Aufräumen (Fokus zurück auf das Element VOR dem Dialog), dann Neuaufbau
   * mit `focus()` auf das erste bedienbare Element — das Schließen-X.
   *
   * Sichtbar wurde es als „der Cursor springt nach jedem Buchstaben auf das X".
   * Betroffen war nicht ein Dialog, sondern jeder: 52 der 67 Aufrufstellen
   * übergeben eine Pfeilfunktion.
   *
   * Über die Ref bleibt der Effekt an `offen` und `titelId` gebunden — er läuft
   * beim Öffnen und beim Schliessen, sonst nie —, und der Tastatur-Handler
   * ruft trotzdem immer die AKTUELLE Funktion.
   */
  const schliessenRef = useRef(onSchliessen);
  schliessenRef.current = onSchliessen;

  useEffect(() => {
    if (!offen) return;
    dialogStapel.push(titelId);
    const panel = panelRef.current;

    // Fokus NICHT stehlen, wenn im Dialog schon etwas fokussiert ist. React
    // wertet `autoFocus` im Commit aus, also VOR diesem Effekt — ohne diese
    // Prüfung überschriebe der Griff nach dem ersten Element das gewünschte
    // Feld mit dem Schließen-X. Genau deshalb landete der Cursor auch beim
    // Öffnen nie im ersten Eingabefeld.
    if (!panel?.contains(document.activeElement)) {
      panel
        ?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    }

    function beiTaste(e: KeyboardEvent) {
      // Nur das oberste Modal reagiert auf Tastatur.
      if (dialogStapel[dialogStapel.length - 1] !== titelId) return;
      if (e.key === 'Escape') {
        schliessenRef.current();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const fokusierbar = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (fokusierbar.length === 0) return;
        const erstes = fokusierbar[0];
        const letztes = fokusierbar[fokusierbar.length - 1];
        if (e.shiftKey && document.activeElement === erstes) {
          e.preventDefault();
          letztes.focus();
        } else if (!e.shiftKey && document.activeElement === letztes) {
          e.preventDefault();
          erstes.focus();
        }
      }
    }
    document.addEventListener('keydown', beiTaste);
    return () => {
      document.removeEventListener('keydown', beiTaste);
      const i = dialogStapel.lastIndexOf(titelId);
      if (i >= 0) dialogStapel.splice(i, 1);
      // Nur zurückgeben, wenn der Auslöser noch da ist (z. B. nicht mit einem
      // Drawer verschwunden) — sonst fiele der Fokus ins Leere.
      const ziel = vorherFokus.current;
      if (ziel?.isConnected) ziel.focus();
    };
  }, [offen, titelId]);

  if (!offen) return null;

  const eigenerOderKopf = eigenerKopf || !!kopf;

  return (
    // Statisches, unscharfes Overlay, das seinen Inhalt scrollt: passt das Modal
    // nicht ins Bild, wächst es nach unten und das Overlay (nicht das Modal)
    // bekommt den Scrollbalken – der unscharfe Hintergrund bleibt dabei statisch.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-[3px]"
      onClick={onSchliessen}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={eigenerOderKopf ? undefined : titelId}
          aria-label={eigenerKopf ? 'Vorschlag-Detail' : kopf ? titel : undefined}
          className={`relative w-full rounded-xl border border-rahmen bg-flaeche shadow-dialog ${
            eigenerKopf ? 'overflow-hidden border-t-4 border-t-vorschlag-rahmen' : 'p-6'
          } ${GROESSE_KLASSE[groesse]}`}
          onClick={(e) => e.stopPropagation()}
        >
          {eigenerKopf ? (
            <button
              onClick={onSchliessen}
              aria-label="Schließen"
              className="absolute right-4 top-4 z-10 rounded-lg border border-rahmen bg-flaeche p-1.5 text-leise hover:bg-flaeche-3"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                {kopf ?? (
                  <>
                    {eyebrow && (
                      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-leise">
                        {eyebrow}
                      </p>
                    )}
                    <h2
                      id={titelId}
                      className={
                        eyebrow
                          ? 'font-serif text-2xl font-bold text-text'
                          : 'text-lg font-semibold text-text'
                      }
                    >
                      {titel}
                    </h2>
                  </>
                )}
              </div>
              <button
                onClick={onSchliessen}
                aria-label="Schließen"
                className="shrink-0 rounded-md p-1 text-leise hover:bg-flaeche-3"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className={eigenerKopf ? '' : 'text-sm text-text'}>{children}</div>
          {fussleiste && (
            <div className="-mx-6 -mb-6 mt-6 flex justify-end gap-3 rounded-b-xl border-t border-rahmen bg-flaeche-2 px-6 py-4">
              {fussleiste}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
