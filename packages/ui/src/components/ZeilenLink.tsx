import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Der Textlink am rechten Rand einer Tabellenzeile — `Erledigen ›`.
 *
 * WARUM KEIN KNOPF, obwohl er wie eine Handlung klingt: In einer Liste mit
 * neun Zeilen stünden neun umrandete Knöpfe untereinander, und das Auge
 * findet die Zeile nicht mehr, auf die es ankommt. Der Textlink ordnet sich
 * unter und bleibt trotzdem der offensichtliche nächste Schritt. Das ist eine
 * ausdrückliche Festlegung des Designs, kein Geschmack.
 *
 * ER FÜHRT NUR HIN. Ein Zeilenlink löst nichts aus — er öffnet den Ort, an
 * dem die Handlung stattfindet. Wer hier etwas ausführen will, nimmt einen
 * Knopf, damit die Zeile nicht zur Falle wird.
 *
 * Als `<a>` gebaut und nicht als `<button>`: Mittelklick und „in neuem Tab
 * öffnen" sollen funktionieren. Wer React-Router benutzt, reicht `Link` als
 * `alsElement` durch.
 */

interface Props extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
  /** Pfeil am Ende. Nur abschalten, wenn der Link nirgendwohin führt. */
  mitPfeil?: boolean;
}

/** Die Klassen, damit ein `Link` aus React-Router gleich aussehen kann. */
export const ZEILEN_LINK_KLASSEN =
  'inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-primaer-softtext transition-colors hover:text-primaer-softtext-hover';

export function ZeilenLink({ children, mitPfeil = true, className, ...rest }: Props) {
  return (
    <a className={`${ZEILEN_LINK_KLASSEN} ${className ?? ''}`} {...rest}>
      {children}
      {mitPfeil && <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />}
    </a>
  );
}
