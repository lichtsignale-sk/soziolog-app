/**
 * DER DATENVERTRAG DES INTERNEN KENNZAHLEN-ENDPUNKTS.
 *
 * Der Zugang ist in EINEM Satz erklärbar, und dieser Satz lautet:
 * „Der Betreiber liest je Instanz sechs Zahlen — keine Inhalte." Damit das
 * wahr bleibt und nicht nur behauptet ist, steht hier eine ABSCHLIESSENDE
 * Liste, gegen die `kennzahlen.spec.ts` jede Antwort Feld für Feld prüft:
 * jedes Feld ist ein Zählwert, ein Tagesdatum, die App-Version oder der
 * Datenbankzustand — und es gibt kein siebtes.
 *
 * WAS HIER NIEMALS HINEINDARF: Namen von Personen, Kreisen oder der
 * Organisation, Titel oder Inhalte von Vorschlägen, Bedenken, Einwänden und
 * Beschlüssen, E-Mail-Adressen, Freitexte jeder Art. Wer diese Datei erweitert,
 * muss die Erlaubnisliste in `kennzahlen.spec.ts` mit erweitern — und damit
 * ausdrücklich entscheiden, was er tut.
 */

/** Zustand der Datenbank aus Sicht der laufenden Anwendung. */
export type DatenbankZustand = 'erreichbar' | 'gestoert';

export interface KennzahlenAntwort {
  /**
   * `gestoert` heißt: die Anwendung läuft, ihre Datenbank antwortet nicht.
   * Genau dann sind alle Zählwerte `null` — ein „0 aktive Personen" wäre an
   * dieser Stelle eine Falschaussage und würde beim Abfragenden als
   * Abwanderung gelesen.
   */
  datenbank: DatenbankZustand;
  /** Anzahl aktiver Personen. `null` nur bei `datenbank === 'gestoert'`. */
  aktivePersonen: number | null;
  /** Anzahl nicht archivierter, aktiver Kreise/Domänen. */
  kreise: number | null;
  /** Tag des jüngsten Eintrags (Vorschlag, Bedenken, Einwand, Beschluss). */
  letzterEintragAm: string | null;
  /** Tag der jüngsten Anmeldung irgendeiner Person. */
  letzteAnmeldungAm: string | null;
  /** Laufende App-Version, z. B. „0.5.2". */
  appVersion: string;
  /**
   * Stimmt der Organisationsname dieser Instanz mit dem überein, den der
   * Abfragende erwartet?
   *
   * `null`, wenn keine Erwartung mitgeschickt wurde (`?nameAbdruck=` fehlt).
   *
   * EIN BOOLEAN IST KEIN INHALT — und genau darum geht es. Gewünscht ist ein
   * Abgleich des Organisationsnamens, verboten ist jeder Name in dieser
   * Antwort. Beides zugleich geht nur so: Die abfragende Stelle
   * schickt einen ABDRUCK des Namens, den sie erwartet, und bekommt ja oder
   * nein zurück. Über die Leitung geht in keiner Richtung ein Name.
   */
  organisationsnameStimmt: boolean | null;
}
