/**
 * Der Status als Pille — nie als Satz.
 *
 * DIE REGEL DAHINTER: Gleiche Farbe bedeutet überall dasselbe. `Aktiv`,
 * `Erledigt` und „läuft" sind grün, weil alle drei heissen „in Ordnung,
 * nichts zu tun". `Ruhend`, „offen" und „im Aufbau" sind bernstein, weil
 * alle drei heissen „braucht einen Blick".
 * Wer diese Zuordnung an einer Stelle bricht, macht sie überall wertlos.
 *
 * DAS WORT STEHT IMMER DA. Farbe ist nie das alleinige Signal — nicht nur
 * wegen Farbfehlsichtigkeit, sondern weil ein grüner Punkt ohne Wort auch
 * für Sehende raten heisst. Der Punkt ist Zugabe, nicht Ersatz.
 *
 * `zusatz` ist für den Fall, dass ein Status eine Unterlage hat, die man
 * nicht verlieren will: „Testphase" mit „läuft" darunter. Zwei getrennte Pillen
 * wären zwei Aussagen, wo es eine ist.
 */

export type StatusArt = 'neutral' | 'hinweis' | 'achtung' | 'problem' | 'bestaetigt';

const STILE: Record<StatusArt, string> = {
  neutral: 'bg-flaeche-3 border-rahmen text-leise',
  hinweis: 'bg-vorschlag-bg border-vorschlag-rahmen-hell text-vorschlag-text',
  achtung: 'bg-bedenken-bg border-bedenken-rahmen-hell text-bedenken-text',
  problem: 'bg-einwand-bg border-einwand-rahmen-hell text-einwand-text',
  bestaetigt: 'bg-beschluss-bg border-beschluss-rahmen-hell text-beschluss-text',
};

const PUNKTE: Record<StatusArt, string> = {
  neutral: 'bg-inaktiv',
  hinweis: 'bg-vorschlag-rahmen',
  achtung: 'bg-bedenken-rahmen',
  problem: 'bg-einwand-rahmen',
  bestaetigt: 'bg-beschluss-rahmen',
};

export function StatusPille({
  art,
  children,
  zusatz,
  mitPunkt = false,
  className,
}: {
  art: StatusArt;
  /** Das Wort. Ohne das Wort keine Pille. */
  children: string;
  /** Zweite Zeile für eine Unterlage („Testphase" / „läuft"). */
  zusatz?: string;
  mitPunkt?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[12.5px] font-semibold leading-tight ${STILE[art]} ${className ?? ''}`}
    >
      {mitPunkt && (
        <span
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${PUNKTE[art]}`}
          aria-hidden="true"
        />
      )}
      <span>
        {children}
        {zusatz !== undefined && (
          <span className="block text-[11px] font-medium opacity-80">{zusatz}</span>
        )}
      </span>
    </span>
  );
}
