/**
 * Antwort-DTOs der Zeit-/Gültigkeits-Engine (Stand zum Stichtag, Gantt,
 * fällige Überprüfungen). Alle Datumsfelder sind reine Kalenderdaten
 * im Format YYYY-MM-DD.
 */
import type { Befristung, GueltigkeitStatus } from './vorgang';

/** Ein am Stichtag geltender Beschluss (mit Titel des Vorschlags). */
export interface StandBeschlussDTO {
  id: string;
  vorschlagId: string;
  titel: string;
  inhalt: string;
  gueltigAb: string;
  gueltigBis: string | null;
  gueltigkeitStatus: GueltigkeitStatus;
  befristung: Befristung;
  ueberpruefungsdatum: string | null;
  erfasstVonLabel: string;
}

/** Stand einer Domäne (Domäne) zum Stichtag. */
export interface DomaeneStandDTO {
  domaeneId: string;
  domaeneName: string;
  beschluesse: StandBeschlussDTO[];
}

/** Ein Beschluss als Zeitspanne im Gesamt-Log (Gantt). */
export interface GesamtLogSpanne {
  id: string;
  /** Zugehöriger Vorschlag (für den Deep-Link-Klick in den Domänen-Log). */
  vorschlagId: string;
  titel: string;
  /** Volltext des zugrundeliegenden Vorschlags (für die Freitextsuche). */
  vorschlagInhalt: string;
  /** Beschlusstext (für die Freitextsuche). */
  beschlussInhalt: string;
  gueltigAb: string;
  gueltigBis: string | null;
  gueltigkeitStatus: GueltigkeitStatus;
  befristung: Befristung;
  ueberpruefungsdatum: string | null;
  /** Beschluss, den diese Spanne abgelöst hat – zum Verketten der Segmente. */
  ersetztBeschlussId: string | null;
}

/** Ein offener Vorschlag als Punkt-Ereignis im Gesamt-Log. */
export interface GesamtLogPunkt {
  id: string;
  titel: string;
  /** Volltext des Vorschlags (für die Freitextsuche). */
  vorschlagInhalt: string;
  datum: string;
}

/** Gesamt-Log-Daten pro Domäne (Spannen + offene Vorschläge). */
export interface GesamtLogDomaene {
  domaeneId: string;
  domaeneName: string;
  spannen: GesamtLogSpanne[];
  offeneVorschlaege: GesamtLogPunkt[];
}

/** Ein fälliger befristeter Beschluss (nur Erkennung). */
export interface FaelligeUeberpruefungDTO {
  id: string;
  vorschlagId: string;
  titel: string;
  gueltigAb: string;
  ueberpruefungsdatum: string;
}
