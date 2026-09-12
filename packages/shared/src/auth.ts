/**
 * Gemeinsame DTO-Typen rund um Authentifizierung und Konto.
 * Von der API (Antwort-Form) und vom Web-Frontend (AuthContext) genutzt.
 */

/** Soziokratische Funktionsrolle in einer Domäne (ohne Sonderrechte). */
export type RolleTyp = 'moderation' | 'logbuchfuehrer' | 'delegierte';

/** Eine Domäne, in der die Person Mitglied ist, samt ihrer dortigen Rollen. */
export interface DomaeneMitRollen {
  domaeneId: string;
  name: string;
  rollen: RolleTyp[];
}

/**
 * Die aktuell angemeldete Person (Antwort von GET /api/auth/ich).
 * Enthält NIEMALS passwortHash.
 */
export interface AktuellePersonDTO {
  id: string;
  name: string;
  /** Anzeigename (z. B. „Marek K."), getrennt vom vollständigen Namen. */
  displayName: string | null;
  nutzername: string;
  loginEmail: string;
  istAdmin: boolean;
  benachrichtigungenAktiv: boolean;
  /** Öffentlicher Pfad des hochgeladenen Avatarbilds (oder null). */
  avatarUrl: string | null;
  /** Personenspezifische Avatarfarbe (Hintergrund, aus Seed/Profil). */
  avatarColor: string | null;
  /** Passende Vordergrund-/Textfarbe für die Initialen (aus Seed/Profil). */
  avatarTextColor: string | null;
  /** Ist die Zwei-Faktor-Authentisierung für dieses Konto aktiviert? */
  zweiFaktorAktiv: boolean;
  /** „Mitglied seit" – Datum der Kontoanlage (YYYY-MM-DD). */
  angelegtAm: string;
  /** „Zuletzt geändert am" für das Passwort (YYYY-MM-DD) oder null. */
  passwortGeaendertAm: string | null;
  organisationName: string;
  domaenen: DomaeneMitRollen[];
}
