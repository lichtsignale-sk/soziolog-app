/**
 * Domänen-Archivierung mit Verwaisungsprüfung (Regel b). Eine Domäne wird nur so
 * archiviert, dass keine Person ohne jede gültige Zugehörigkeit zurückbleibt.
 * Anders als die frühere Auflösung ist das Archivieren reversibel (Wiederbeleben).
 * Alle Datumsfelder sind reine Kalenderdaten (YYYY-MM-DD).
 */

export type ArchivierenAktion = 'loeschen' | 'behalten_in_domaene';

/** Eine Person, die durch die Archivierung verwaisen würde. */
export interface VerwaisendePerson {
  personId: string;
  name: string;
  /** Aktuelle soziokratische Rollen dieser Person in der zu archivierenden Domäne. */
  rollenImDomaene: string[];
}

/** Eine mögliche Ziel-Domäne, um eine Person weiter aufzunehmen. */
export interface ZielDomaeneOption {
  id: string;
  name: string;
}

/** Vorschau der Archivierung: wer verwaist, welche Optionen bestehen. */
export interface ArchivierenVorschau {
  domaeneId: string;
  domaeneName: string;
  /** Hat die Domäne Vorschläge/Beschlüsse? (Bleiben im Log erhalten.) */
  hatEintraege: boolean;
  /**
   * Hat die Domäne noch aktive (nicht archivierte) Unter-Domänen? Dann ist das
   * Archivieren gesperrt, sonst entstünde ein verwaister Teilbaum (Regel A9).
   */
  hatAktiveUnterDomaenen: boolean;
  verwaisende: VerwaisendePerson[];
  /** Andere aktive Domänen der Organisation (mögliche Ziel-Domänen). */
  zielDomaenen: ZielDomaeneOption[];
}

/** Entscheidung für EINE verwaisende Person. */
export interface ArchivierenEntscheidung {
  personId: string;
  aktion: ArchivierenAktion;
  /** Pflicht bei aktion === 'behalten_in_domaene': aufnehmende Domäne. */
  zielDomaeneId?: string;
}

/** Eingabe zum Archivieren: je verwaisender Person eine Entscheidung. */
export interface ArchivierenEingabe {
  entscheidungen: ArchivierenEntscheidung[];
}
