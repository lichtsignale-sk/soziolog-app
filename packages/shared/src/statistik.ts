/**
 * Antwort-DTOs der Statistik-Auswertungen. Reine Aggregationen über dieselbe
 * Datenbasis; keine eigenen Daten. Alle Datumsfelder sind reine Kalenderdaten.
 */

/** Aktive Mitgliedschaften je Domäne (Domäne). */
export interface NutzerProDomaene {
  domaeneId: string;
  domaeneName: string;
  anzahl: number;
}

/** Anzahl Bedenken je Kalendermonat (Monat = YYYY-MM). */
export interface BedenkenProMonat {
  monat: string;
  anzahl: number;
}

/** Bedenken und Einwände (getrennt nach Schweregrad) je Domäne. */
export interface DomaeneEinwaendeBedenken {
  domaeneId: string;
  domaeneName: string;
  bedenken: number;
  einwaendeLeicht: number;
  einwaendeSchwer: number;
}

/** Beschlüsse je Domäne. */
export interface DomaeneEntscheidungen {
  domaeneId: string;
  domaeneName: string;
  beschluesse: number;
}
