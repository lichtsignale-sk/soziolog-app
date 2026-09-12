/**
 * Leichtes Signal, mit dem Aktionen (Korrektur bestätigen/ablehnen, Anschauen des
 * Korrekturanträge-Tabs) das Benachrichtigungs-Zentrum sofort zum Neuladen des
 * Zählers anstoßen – ohne auf den 30-Sekunden-Poll zu warten.
 */
export const BENACHRICHTIGUNGEN_EVENT = 'benachrichtigungen:aktualisiert';

export function meldeBenachrichtigungenAktualisiert(): void {
  window.dispatchEvent(new Event(BENACHRICHTIGUNGEN_EVENT));
}
