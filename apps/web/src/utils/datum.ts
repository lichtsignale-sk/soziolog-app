/**
 * Formatiert einen ISO-Datums-String (YYYY-MM-DD) für die Anzeige als dd.mm.yyyy.
 * Rein für die Darstellung – Speicherung/Übertragung läuft weiterhin über die
 * shared-Helfer (heute()/datumAusString()/…), die den ISO-String unverändert nutzen.
 */
export function formatDatum(isoString: string): string {
  const teile = isoString.split('-');
  if (teile.length !== 3) return isoString;
  const [jahr, monat, tag] = teile;
  return `${tag}.${monat}.${jahr}`;
}
