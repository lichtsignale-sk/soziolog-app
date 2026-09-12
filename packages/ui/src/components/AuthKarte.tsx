import type { ReactNode } from 'react';

/** Zentrierte Karte für die Auth-Seiten (Login, Passwort, …). */
export function AuthKarte({
  titel,
  marke,
  untertitel,
  children,
}: {
  titel: string;
  /**
   * Kleine Zeile unter dem Titel, die das SYSTEM benennt.
   *
   * Für Oberflächen, die das Paket nutzen und neben einer anderen stehen,
   * deren Anmeldeseite ebenfalls nur „SozioLog" trägt: Wer den Link aus
   * einem Lesezeichen öffnet, soll sehen, wo er gerade ist. In der
   * angemeldeten Ansicht steht die Angabe in der Seitenleiste — davor fehlte
   * sie, also genau dort, wo die Frage überhaupt aufkommt.
   *
   * Optional, weil eine einzelne Oberfläche sie nicht braucht: Dort gibt es
   * kein zweites System, mit dem sich die Seite verwechseln liesse.
   *
   * Schriftbild bewusst identisch mit einer Beschriftung in der Seitenleiste.
   */
  marke?: string;
  untertitel?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-flaeche-2 flex items-center justify-center px-4">
      <div className="bg-flaeche rounded-xl shadow-karte p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-primaer mb-1">{titel}</h1>
        {marke && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-still">
            {marke}
          </p>
        )}
        {untertitel && <p className="text-leise mb-6 text-sm">{untertitel}</p>}
        {children}
      </div>
    </div>
  );
}
