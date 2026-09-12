import type { LucideIcon } from 'lucide-react';

/**
 * Eine Kennzahl als Kachel — Zahl gross, Bedeutung klein, ein Klick führt
 * zur gefilterten Liste dahinter.
 *
 * WOFÜR SIE GEDACHT IST — und wofür nicht. Sie gehört auf Ansichten, auf
 * denen Zahlen der eigentliche Inhalt sind: Summen, überfällige Posten,
 * Jahreswerte. Auf eine Startseite gehört sie NICHT; dort gilt
 * „Aufgabenliste, keine Kacheln". Eine Kennzahl, die niemanden zu einer
 * Handlung führt, ist Dekoration.
 *
 * DESHALB IST SIE IMMER KLICKBAR. Wenn eine Zahl es wert ist, gross zu
 * stehen, ist sie es auch wert, dass man dahinterschauen kann. Ohne `onKlick`
 * lässt sie sich nicht bauen.
 *
 * DIE FARBE GEHÖRT DER BEDEUTUNG. `problem` gibt der ganzen Karte einen roten
 * Rahmen — das ist der einzige Fall, in dem eine Kachel aus der Reihe fällt,
 * und genau dann soll sie es.
 */

export type KachelArt = 'neutral' | 'hinweis' | 'achtung' | 'problem' | 'bestaetigt';

const STILE: Record<KachelArt, { kreis: string; symbol: string; rahmen: string; zahl: string }> = {
  neutral: {
    kreis: 'bg-flaeche-3',
    symbol: 'text-leise',
    rahmen: 'border-rahmen',
    zahl: 'text-text',
  },
  hinweis: {
    kreis: 'bg-vorschlag-bg',
    symbol: 'text-vorschlag-text',
    rahmen: 'border-rahmen',
    zahl: 'text-text',
  },
  achtung: {
    kreis: 'bg-bedenken-bg',
    symbol: 'text-bedenken-text',
    rahmen: 'border-rahmen',
    zahl: 'text-text',
  },
  problem: {
    kreis: 'bg-einwand-bg',
    symbol: 'text-einwand-text',
    rahmen: 'border-einwand-rahmen-hell',
    zahl: 'text-einwand-text',
  },
  bestaetigt: {
    kreis: 'bg-beschluss-bg',
    symbol: 'text-beschluss-text',
    rahmen: 'border-rahmen',
    zahl: 'text-text',
  },
};

export function Kennzahlkachel({
  Icon,
  zahl,
  label,
  art = 'neutral',
  onKlick,
  gewaehlt = false,
}: {
  Icon: LucideIcon;
  /** Schon fertig formatiert — `1.860,00 €`, `4`. Diese Karte rechnet nicht. */
  zahl: string;
  label: string;
  art?: KachelArt;
  onKlick: () => void;
  gewaehlt?: boolean;
}) {
  const stil = STILE[art];
  return (
    <button
      type="button"
      onClick={onKlick}
      aria-pressed={gewaehlt}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-flaeche px-4 py-3.5 text-left transition-all hover:-translate-y-px hover:shadow-karte-hover ${stil.rahmen} ${gewaehlt ? 'ring-2 ring-primaer' : ''}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${stil.kreis}`}>
        <Icon className={`h-[18px] w-[18px] ${stil.symbol}`} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className={`block text-2xl font-bold leading-tight ziffern-tabellarisch ${stil.zahl}`}
        >
          {zahl}
        </span>
        <span className="block text-[13.5px] text-leise">{label}</span>
      </span>
    </button>
  );
}
