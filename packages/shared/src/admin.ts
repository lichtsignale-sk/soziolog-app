/**
 * Lese-DTOs für die Admin-Verwaltungsoberfläche (Personen- und Domäne/Rollen-
 * Verwaltung). Alle Datumsfelder sind reine Kalenderdaten (YYYY-MM-DD).
 */
import type { DomaeneMitRollen, RolleTyp } from './auth';

/** Abgeleiteter Kontostatus einer Person. */
export type PersonStatus = 'aktiv' | 'deaktiviert' | 'eingeladen';

/** Abgeleitete Software-Berechtigung (null bei noch nicht eingelösten Einladungen). */
export type PersonBerechtigung =
  | 'Administrativ'
  | 'Protokollierend'
  | 'Teilhabend'
  | null;

/** Eine Person aus Admin-Sicht, inkl. ihrer aktuellen Domänen/Rollen. */
export interface AdminPersonDTO {
  id: string;
  name: string;
  nutzername: string;
  loginEmail: string;
  /** Personenspezifische Avatarfarbe (Hintergrund) oder null. */
  avatarColor: string | null;
  /** Passende Vordergrund-/Textfarbe für die Initialen oder null. */
  avatarTextColor: string | null;
  istAdmin: boolean;
  aktiv: boolean;
  /** Abgeleitet: deaktiviert (!aktiv) / eingeladen (aktiv ohne Passwort) / aktiv. */
  status: PersonStatus;
  /** Abgeleitete Software-Berechtigung (null solange nur eingeladen). */
  berechtigung: PersonBerechtigung;
  benachrichtigungenAktiv: boolean;
  angelegtAm: string;
  domaenen: DomaeneMitRollen[];
}

/** Eine aktuelle Rollenzuweisung einer Person in einem Domäne. */
export interface DomaeneMitgliedRolleDTO {
  rollenId: string;
  rolleTyp: RolleTyp;
  gueltigAb: string;
}

/** Ein aktuelles Mitglied eines Domäne samt seiner Rollen dort. */
export interface DomaeneMitgliedDTO {
  mitgliedschaftId: string;
  personId: string;
  name: string;
  nutzername: string;
  gueltigAb: string;
  rollen: DomaeneMitgliedRolleDTO[];
}

/** Domäne-Detail für die Admin-Verwaltung: aktuelle Mitglieder + Rollen. */
export interface DomaeneMitgliederDTO {
  domaeneId: string;
  domaeneName: string;
  mitglieder: DomaeneMitgliedDTO[];
}
