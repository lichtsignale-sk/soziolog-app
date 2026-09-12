import type { ReactNode } from 'react';
import { AlertTriangle, Info, ShieldCheck, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Ein Hinweis in EINER Zeile: Icon, Satz, optional ein Knopf.
 *
 * WOZU SIE DA IST. Sie ersetzt Erklärabsätze durch Struktur — ein
 * vierzeiliger Kasten über einer Liste wird ein Satz, drei erklärende
 * Absätze werden eine Zeile. Diese Komponente ist der Ort, an dem das
 * passiert. Sie ist bewusst schmal gebaut: Wer mehr als einen
 * Satz unterbringen will, benutzt das falsche Werkzeug.
 *
 * DIE FARBE IST BEDEUTUNG, KEINE DEKORATION — dieselben vier Familien wie
 * überall in SozioLog:
 *
 * - `hinweis` (blau) — eine Auskunft, nichts zu tun
 * - `achtung` (bernstein) — braucht einen Blick, blockiert nichts
 * - `problem` (rot) — Sperre, Fehler, unumkehrbare Folge
 * - `bestaetigt` (grün) — eine Zusicherung, die das System einhält
 *
 * Das Icon ist NICHT frei wählbar. Es gehört zur Bedeutung, und ein
 * abweichendes Symbol an einer Stelle machte die Farbfamilie unlesbar.
 */

export type NoticeArt = 'hinweis' | 'achtung' | 'problem' | 'bestaetigt';

const STILE: Record<NoticeArt, { rahmen: string; flaeche: string; text: string; Icon: LucideIcon }> =
  {
    hinweis: {
      flaeche: 'bg-vorschlag-bg',
      rahmen: 'border-vorschlag-rahmen-hell',
      text: 'text-vorschlag-text',
      Icon: Info,
    },
    achtung: {
      flaeche: 'bg-bedenken-bg',
      rahmen: 'border-bedenken-rahmen-hell',
      text: 'text-bedenken-text',
      Icon: AlertTriangle,
    },
    problem: {
      flaeche: 'bg-einwand-bg',
      rahmen: 'border-einwand-rahmen-hell',
      text: 'text-einwand-text',
      Icon: XCircle,
    },
    bestaetigt: {
      flaeche: 'bg-primaer-softer',
      rahmen: 'border-primaer-softrahmen',
      text: 'text-primaer-softtext',
      Icon: ShieldCheck,
    },
  };

export function NoticeBar({
  art,
  children,
  aktion,
  className,
}: {
  art: NoticeArt;
  /** Der Satz. Eine Zeile — mehr gehört in einen Dialog. */
  children: ReactNode;
  /** Optionaler Knopf am rechten Rand. */
  aktion?: ReactNode;
  className?: string;
}) {
  const stil = STILE[art];
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${stil.flaeche} ${stil.rahmen} ${stil.text} ${className ?? ''}`}
    >
      <stil.Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
      {aktion}
    </div>
  );
}
