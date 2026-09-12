/**
 * Gemeinsame Antwort-DTOs für den Kern-Flow (Vorschlag → Bedenken/Einwände →
 * Beschluss). Von API (Antwort-Form) und Web-Frontend genutzt.
 *
 * Anonymität (docs/02): Der Beschluss wird nur als Rollen-Label
 * „Logbuchführer <Domäne>" ausgegeben, NIE als Klarname. Der Vorschlag zeigt
 * dagegen den echten Namen der erfassenden Person (administrative Handlung,
 * analog zu bestaetigtVonName im Änderungslog) – die Person ist immer die
 * zum Erfassungszeitpunkt gültige Logbuchführung des Domäne.
 * Bedenken/Einwände enthalten gar keinen Urheber.
 * Alle datum-Felder sind reine Kalenderdaten im Format YYYY-MM-DD.
 */

export type GovernanceTyp = 'governance' | 'operativ';
export type VorschlagStatus = 'offen' | 'entschieden' | 'zurueckgezogen';
export type EinwandSchweregrad = 'leicht' | 'schwerwiegend';
export type Befristung = 'befristet' | 'unbefristet';
export type GueltigkeitStatus =
  | 'gueltig'
  | 'in_ueberpruefung'
  | 'ersetzt'
  | 'beendet';

/** Bedenken – bewusst ohne Urheber (anonym). */
export interface BedenkenDTO {
  id: string;
  inhalt: string;
  datum: string;
}

/** Einwand – bewusst ohne Urheber (anonym). */
export interface EinwandDTO {
  id: string;
  inhalt: string;
  schweregrad: EinwandSchweregrad;
  integration: string | null;
  datum: string;
}

/** Verweis auf einen anderen Beschluss/Vorschlag (Ablösungskette). */
export interface BeschlussVerweis {
  beschlussId: string;
  vorschlagId: string;
  titel: string;
}

/** Beschluss – Handlung, daher mit Rollen-Label statt Klarname. */
export interface BeschlussDTO {
  id: string;
  inhalt: string;
  notiz: string | null;
  befristung: Befristung;
  ueberpruefungsdatum: string | null;
  gueltigkeitStatus: GueltigkeitStatus;
  gueltigAb: string;
  gueltigBis: string | null;
  datum: string;
  erfasstVonLabel: string;
  /** Beschluss, den dieser abgelöst hat (null, wenn eigenständig). */
  ersetztBeschlussId: string | null;
  /** Nachfolger, der diesen Beschluss abgelöst hat (bei status=ersetzt). */
  ersetztDurch: BeschlussVerweis | null;
}

/** Vorschlag mit verschachtelten Einträgen. */
export interface VorschlagDTO {
  id: string;
  domaeneId: string;
  titel: string;
  inhalt: string;
  governanceTyp: GovernanceTyp;
  status: VorschlagStatus;
  datum: string;
  /** Echter Name der Person, die den Vorschlag erfasst hat (kein Rollenlabel). */
  erfasstVonName: string;
  bedenken: BedenkenDTO[];
  einwaende: EinwandDTO[];
  beschluss: BeschlussDTO | null;
  /** Gesetzt, wenn dieser Vorschlag eine Neufassung ist (löst einen Beschluss ab). */
  neufassungVon: BeschlussVerweis | null;
}
