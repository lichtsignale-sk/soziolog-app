/**
 * Korrektur-Workflow: feldweise Änderung an bestehenden (sonst unveränderlichen)
 * Einträgen über einen Antrag, den ein Admin bestätigt. Plus Änderungslog.
 * Alle Datumsfelder sind reine Kalenderdaten im Format YYYY-MM-DD.
 */

export type KorrekturZielTyp = 'vorschlag' | 'bedenken' | 'einwand' | 'beschluss';
export type KorrekturStatus = 'offen' | 'bestaetigt' | 'abgelehnt';

/**
 * WHITELIST der korrigierbaren Felder je Zieltyp. EINE gemeinsame Quelle für
 * Backend (harte Sicherheitsgrenze: nur diese Felder dürfen je über eine
 * Korrektur geschrieben werden) und Frontend (nur diese Felder sind editierbar).
 * Zeit-, Status-, Gültigkeits-, Schweregrad- und Governance-Felder sind bewusst
 * NICHT korrigierbar – sonst ließe sich der Log über die Korrektur verfälschen.
 */
export const KORRIGIERBARE_FELDER: Record<KorrekturZielTyp, readonly string[]> = {
  vorschlag: ['titel', 'inhalt'],
  bedenken: ['inhalt'],
  einwand: ['inhalt', 'integration'],
  // ueberpruefungsdatum deckt zugleich die Befristung ab: leerer Wert ⇒
  // unbefristet, ein Datum ⇒ befristet bis zu diesem Tag.
  beschluss: ['inhalt', 'notiz', 'ueberpruefungsdatum'],
};

/** Ist das Feld für den Zieltyp korrigierbar (gegen die Whitelist)? */
export function istKorrigierbar(zielTyp: KorrekturZielTyp, feld: string): boolean {
  return KORRIGIERBARE_FELDER[zielTyp]?.includes(feld) ?? false;
}

/** Eingabe zum Stellen eines Korrekturantrags. */
export interface KorrekturAntragEingabe {
  zielTyp: KorrekturZielTyp;
  zielId: string;
  feld: string;
  neuerInhalt: string;
  begruendung?: string;
}

/** Ein offener Korrekturantrag für die Admin-Queue. */
export interface KorrekturantragDTO {
  id: string;
  zielTyp: KorrekturZielTyp;
  feld: string;
  alterInhalt: string;
  neuerInhalt: string;
  begruendung: string | null;
  /** Antragsteller namentlich (immer angezeigt). */
  beantragtVonName: string;
  /** Optionales Rollen·Domäne-Label ("Logbuchführend · <Domäne>"). */
  beantragtVonLabel: string;
  beantragtAm: string;
  vorschlagId: string;
  vorschlagTitel: string;
  domaeneName: string;
}

/** Ein bestätigter oder abgelehnter Eintrag im Korrekturen-Log (für alle lesbar). */
export interface AenderungslogEintragDTO {
  id: string;
  zielTyp: KorrekturZielTyp;
  feld: string;
  alterInhalt: string;
  neuerInhalt: string;
  /** Antragsteller namentlich (immer angezeigt). */
  beantragtVonName: string;
  /** Optionales Rollen·Domäne-Label. */
  beantragtVonLabel: string;
  /** Entscheidender Admin mit Klarname. */
  bestaetigtVonName: string;
  beantragtAm: string;
  entschiedenAm: string;
  vorschlagId: string;
  vorschlagTitel: string;
  domaeneName: string;
  /** Status des Eintrags (bestaetigt oder abgelehnt). */
  status: KorrekturStatus;
  /** Begründung des Admins bei Ablehnung (nur bei status = abgelehnt gesetzt). */
  ablehnungsgrund: string | null;
  /** Benachrichtigung dieser Bestätigung (für den Lesestand), falls vorhanden. */
  benachrichtigungId: string | null;
}
