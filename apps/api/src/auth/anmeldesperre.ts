/**
 * Regeln der Anmeldesperre je Konto.
 *
 * WARUM ZUSÄTZLICH ZUM RATE-LIMIT: Der Throttler begrenzt, wie oft EINE Adresse
 * fragen darf (5/min auf der Login-Route). Er begrenzt nicht, wie oft AUF EIN
 * KONTO geraten wird — mit einer Handvoll Adressen sind mehrere tausend
 * Versuche pro Tag auf ein bekanntes Konto möglich. `docs/04-sicherheit.md`
 * verlangt ausdrücklich „Rate-Limiting UND Backoff".
 *
 * ABWÄGUNG: Eine Sperre je Konto lässt sich missbrauchen, um jemanden
 * auszusperren. Deshalb ist sie kurz (15 Minuten) und hebt sich von selbst auf.
 * Sie kostet den Angreifer den Großteil seiner Versuche, aber die betroffene
 * Person nur eine Viertelstunde.
 */

/** Ab so vielen Fehlversuchen in Folge wird gesperrt. */
export const SPERRE_AB_VERSUCHEN = 10;

/** So lange gilt die Sperre. */
export const SPERRDAUER_MS = 15 * 60 * 1000;

/** Ist das Konto zum Zeitpunkt `jetzt` gesperrt? */
export function istGesperrt(
  gesperrtBis: Date | null | undefined,
  jetzt: Date = new Date(),
): boolean {
  if (!gesperrtBis) return false;
  return gesperrtBis.getTime() > jetzt.getTime();
}

/** Ist die Schwelle mit diesem Stand erreicht? */
export function sperreErreicht(fehlversuche: number): boolean {
  return fehlversuche >= SPERRE_AB_VERSUCHEN;
}

/** Ende der Sperre, gerechnet ab `jetzt`. */
export function sperrEnde(jetzt: Date = new Date()): Date {
  return new Date(jetzt.getTime() + SPERRDAUER_MS);
}
