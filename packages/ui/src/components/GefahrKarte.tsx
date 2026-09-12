import type { ReactNode } from 'react';

/**
 * Die Karte für den einen unumkehrbaren Vorgang eines Bereichs.
 *
 * SIE HAT EINEN ROTEN RAHMEN, ABER KEINE ROTE FLÄCHE. Das ist der ganze
 * Trick: Eine rot gefüllte Karte am Ende jeder Detailseite liest irgendwann
 * niemand mehr, und dann ist die Warnung wertlos. Der Rahmen genügt, um sie
 * vom Rest abzusetzen; die Farbe steckt im Knopf, den man wirklich drückt.
 *
 * EINE ZEILE, EIN KNOPF. Die vollständigen Folgen gehören in den
 * Bestätigungsdialog, nicht hierher — dort liest man sie, hier überfliegt man
 * sie. Der Knopf trägt drei Punkte („Löschen …"), weil er nichts vollzieht,
 * sondern fragt.
 */

export function GefahrKarte({
  titel,
  children,
  aktion,
  ueberschriftEbene = 2,
}: {
  titel: string;
  /** Eine Zeile. Was ausführlich erklärt werden muss, steht im Dialog. */
  children: ReactNode;
  /** Der Knopf. Seine Beschriftung endet auf „…", weil er einen Dialog öffnet. */
  aktion: ReactNode;
  /**
   * Die Überschriftenebene — abhängig davon, was auf der Seite darüber steht.
   *
   * Sie ist eine Angabe und keine Annahme, weil die Karte den Aufbau um sich
   * herum nicht kennt: Auf einer Seite mit `h1` und Abschnitten ist sie eine
   * `h2`, innerhalb eines Abschnitts mit eigener `h2` eine `h3`. Eine feste
   * Wahl liesse eine Ebene aus, und für eine Bildschirmleserin ist die
   * Gliederung die Landkarte der Seite. Beim Schreiben dieser Komponente ist
   * genau das passiert — `axe` hat es gemeldet.
   */
  ueberschriftEbene?: 2 | 3;
}) {
  const Ueberschrift = ueberschriftEbene === 2 ? 'h2' : 'h3';
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-einwand-rahmen-hell bg-flaeche px-[18px] py-4">
      <div className="min-w-0">
        <Ueberschrift className="text-[17px] font-bold text-text">{titel}</Ueberschrift>
        <p className="mt-0.5 text-sm text-leise">{children}</p>
      </div>
      {aktion}
    </section>
  );
}
