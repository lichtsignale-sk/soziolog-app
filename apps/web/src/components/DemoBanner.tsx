import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/** CSS-Variable mit der aktuellen Höhe des Streifens (0, wenn keiner da ist). */
export const DEMO_BANNER_VARIABLE = '--demo-banner-hoehe';

/**
 * Schmaler Hinweisstreifen ganz oben, sichtbar nur wenn die Instanz als
 * öffentliche Demo läuft (DEMO_MODE=1 → status.demoModus). Macht transparent,
 * dass Änderungen nicht dauerhaft sind.
 *
 * DER STREIFEN MELDET SEINE HÖHE. Kopfleiste und Seitenleiste der Shell sind
 * an der Fensterhöhe ausgerichtet (`100dvh`); ohne Abzug schob der Streifen
 * beide um seine Höhe nach unten, und das untere Ende der Seitenleiste lag
 * außerhalb des Fensters. Die Höhe steht deshalb als `--demo-banner-hoehe`
 * am Wurzelelement — gemessen, nicht angenommen, denn auf schmalen Fenstern
 * bricht der Text um und der Streifen wird höher. Er bleibt oben stehen
 * (`sticky`), damit die Abzüge auch beim Scrollen stimmen.
 */
export function DemoBanner() {
  const { demoModus } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wurzel = document.documentElement;
    const streifen = ref.current;
    if (!streifen) {
      wurzel.style.removeProperty(DEMO_BANNER_VARIABLE);
      return;
    }
    const setze = () =>
      wurzel.style.setProperty(DEMO_BANNER_VARIABLE, `${streifen.offsetHeight}px`);
    setze();
    const beobachter =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(setze) : null;
    beobachter?.observe(streifen);
    return () => {
      beobachter?.disconnect();
      wurzel.style.removeProperty(DEMO_BANNER_VARIABLE);
    };
  }, [demoModus]);

  if (!demoModus) return null;
  return (
    <div
      ref={ref}
      role="status"
      className="sticky top-0 z-40 w-full border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
    >
      <span aria-hidden="true">🔄 </span>
      <span className="font-semibold">Demo-Umgebung.</span>{' '}
      Probier alles aus – alle Änderungen werden{' '}
      <span className="font-semibold">stündlich automatisch zurückgesetzt</span>.
    </div>
  );
}
