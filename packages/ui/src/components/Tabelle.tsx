import type { ReactNode } from 'react';

/**
 * Semantische Tabelle mit einheitlicher Gestaltung (Token-basiert).
 *
 * `spaltenBreiten` ist OPTIONAL und ändert das Verhalten grundlegend:
 *
 * OHNE die Angabe bleibt alles wie bisher — `table-layout: auto`, die
 * Spalten wachsen mit ihrem Inhalt, die Hülle scrollt waagerecht. Für kurze,
 * gleichförmige Inhalte ist das richtig, und die bestehenden Aufrufer in
 * `apps/web` verhalten sich unverändert (identisches Markup, identische
 * Klassen).
 *
 * MIT der Angabe schaltet die Tabelle ab `sm` auf `table-layout: fixed` und
 * bekommt eine `<colgroup>` mit den übergebenen Breiten.
 *
 * WARUM DAS NÖTIG IST: Unter `table-layout: auto` bestimmt der längste Inhalt
 * die Spaltenbreite. `truncate` auf einem Element INNERHALB der Zelle hat dann
 * keinerlei Wirkung — die Zelle wächst einfach mit, und die Tabelle wird
 * breiter als ihre Hülle. Gemessen bei 768 px mit einem hundert Zeichen langen
 * Vereinsnamen: 1309 px Inhalt in einer 734 px breiten Hülle. Erst
 * `table-layout: fixed` gibt der Spalte eine Breite, an der das Kürzen
 * überhaupt greifen kann.
 *
 * WARUM ERST AB `sm`: Unterhalb von 640 px ist eine feste Aufteilung auf
 * mehrere Spalten unbrauchbar eng; dort bleibt die Tabelle bewusst bei
 * `auto` und lässt sich seitlich schieben.
 *
 * Die Breiten sind Tailwinds eingebaute Bruchteil-Klassen (Zwölftel, Viertel,
 * Drittel) — die vorhandene Skala, keine freien Pixelwerte.
 *
 * Beispiele stehen hier bewusst NICHT als Klassennamen im Fließtext: Tailwind
 * liest auch Kommentare und nähme sie als benutzte Klassen auf. Sie landeten
 * dann im Stylesheet JEDER Anwendung, die dieses Paket einbindet — auch dort,
 * wo sie niemand verwendet. Die Form zeigen die Tests (`Tabelle.test.tsx`).
 */
export function Tabelle({
  spalten,
  children,
  beschriftung,
  spaltenBreiten,
  variante = 'standard',
  aktionsspalte = false,
  spaltenNurVorlesen,
  mindestbreite,
}: {
  spalten: string[];
  children: ReactNode;
  beschriftung?: string;
  /** Eine Tailwind-Breitenklasse je Spalte, in der Reihenfolge von `spalten`. */
  spaltenBreiten?: string[];
  /**
   * `standard` ist der Bestand und bleibt die Vorgabe — jede vorhandene
   * Tabelle in allen Oberflächen, die das Paket nutzen, sieht unverändert aus.
   *
   * `liste` ist die dichte Datentabelle für umfangreiche Listen: leiser
   * Kopf auf abgesetzter Fläche, leisere Zeilentrenner, Tabellenziffern und
   * eine Hover-Fläche je Zeile. Sie ist NICHT die neue Vorgabe, weil eine
   * geänderte Vorgabe 47 Dateien in `apps/web` mitzöge.
   */
  variante?: 'standard' | 'liste';
  /** Rückt Kopf und Zellen der LETZTEN Spalte nach rechts (Handlungen). */
  aktionsspalte?: boolean;
  /**
   * Spalten, deren Kopf nur VORGELESEN und nicht gezeigt wird.
   *
   * Für Spalten, die im Entwurf keine Überschrift tragen — die Pfeilspalte
   * am Zeilenende etwa. Ein LEERER Tabellenkopf ist kein zulässiger Ausweg:
   * `axe` meldet ihn als Verstoss, und zu Recht — wer die Tabelle vorlesen
   * lässt, hört an dieser Stelle nichts und weiss nicht, was die Zelle
   * enthält. Gefunden genau so, beim Prüfen einer solchen Liste mit `axe`.
   */
  spaltenNurVorlesen?: boolean[];
  /**
   * Tailwind-Klasse für eine Mindestbreite der Tabelle.
   *
   * Ohne sie quetschen sich acht Spalten auf einem schmalen Bildschirm zu
   * Unlesbarkeit zusammen. Mit ihr scrollt die Hülle waagerecht — die Zeile
   * bleibt lesbar, und die SEITE scrollt trotzdem nicht.
   *
   * KEIN BEISPIEL ALS KLASSENNAME an dieser Stelle, aus demselben Grund wie
   * im Dateikopf: Tailwind liest auch Kommentare und nähme den Namen als
   * benutzt auf. Die Regel landete dann im Stylesheet JEDER Anwendung, die
   * dieses Paket einbindet — auch dort, wo keine Tabelle sie braucht. Genau
   * das ist beim Schreiben dieser Erweiterung einmal passiert und im
   * gebauten Bundle von `apps/web` aufgefallen.
   */
  mindestbreite?: string;
}) {
  const festeBreiten = spaltenBreiten !== undefined;
  const liste = variante === 'liste';
  return (
    <div className="overflow-x-auto rounded-xl border border-rahmen">
      <table
        className={[
          'w-full text-left text-sm',
          festeBreiten ? 'sm:table-fixed' : '',
          liste ? 'ziffern-tabellarisch' : '',
          mindestbreite ?? '',
          aktionsspalte
            ? '[&_td:last-child]:text-right [&_th:last-child]:text-right'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {beschriftung && <caption className="sr-only">{beschriftung}</caption>}
        {festeBreiten && (
          <colgroup>
            {spalten.map((s, i) => (
              <col key={s} className={spaltenBreiten[i] ?? ''} />
            ))}
          </colgroup>
        )}
        <thead className={liste ? 'bg-flaeche-4 text-leise' : 'bg-flaeche-3 text-leise'}>
          <tr>
            {spalten.map((s, i) => (
              <th
                key={s}
                scope="col"
                // `break-words`: Unter festen Spaltenbreiten hat ein langes
                // Wort in der Kopfzeile keinen Ausweichplatz und schöbe sich
                // sonst über die Nachbarspalte. Bei `auto`-Layout (allen
                // bisherigen Aufrufern) ändert die Regel nichts, weil die
                // Spalte dort ohnehin mit ihrem Inhalt wächst.
                className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide break-words"
              >
                {spaltenNurVorlesen?.[i] === true ? (
                  <span className="sr-only">{s}</span>
                ) : (
                  s
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          className={
            liste
              ? 'divide-y divide-rahmen-leise bg-flaeche text-text [&_tr:hover]:bg-flaeche-4'
              : 'divide-y divide-rahmen bg-flaeche text-text'
          }
        >
          {children}
        </tbody>
      </table>
    </div>
  );
}
