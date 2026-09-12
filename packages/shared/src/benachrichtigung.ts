/**
 * Benachrichtigungen: Ereignis (Benachrichtigung) plus Pro-Person-Lesestatus
 * (BenachrichtigungEmpfang). Alle Datumsfelder sind reine Kalenderdaten.
 */

import type { KorrekturZielTyp } from './korrektur';

export type BenachrichtigungTyp =
  | 'ueberpruefung_faellig'
  | 'korrektur_beantragt'
  | 'korrektur_bestaetigt'
  | 'korrektur_abgelehnt'
  | 'vorschlag_neu'
  | 'beschluss_neu';

/** Eine Benachrichtigung aus Sicht der angemeldeten Person (mit Lesestatus). */
export interface BenachrichtigungDTO {
  /** ID der Benachrichtigung (nicht des Empfangs). */
  id: string;
  typ: BenachrichtigungTyp;
  inhalt: string;
  domaeneId: string | null;
  domaeneName: string | null;
  faelligAm: string | null;
  erstelltAm: string;
  gelesen: boolean;
  gelesenAm: string | null;
  /** Für den Sprung zum Beschluss (Überprüfung). */
  betrifftBeschlussId: string | null;
  vorschlagId: string | null;
  /** Für den Sprung in den Änderungslog (Korrektur). */
  betrifftKorrekturId: string | null;
  /** Bereich der betroffenen Korrektur (nur bei Korrektur-Benachrichtigungen). */
  korrekturZielTyp: KorrekturZielTyp | null;
}

/** Lesestand einer Benachrichtigung: wie viele Empfänger schon gelesen haben. */
export interface LesestandDTO {
  gelesen: number;
  gesamt: number;
  /** true, wenn Empfänger vorhanden sind, aber noch niemand gelesen hat. */
  auffaellig: boolean;
}

export interface AnzahlUngelesenDTO {
  anzahl: number;
}
