/**
 * Lese-DTOs für Domänen (Domänen-Karte & Domänen-Log).
 */

export type DomaeneTyp = 'dauerdomaene' | 'arbeitsdomaene';

/**
 * Höchstzahl an Unter-Unterdomänen (Ebene 2) je Unterdomäne (Ebene 1).
 * Hauptdomänen (Ebene 0) und ihre Unterdomänen sind unbegrenzt; eine vierte
 * Ebene gibt es nicht. Begrenzung dient der Darstellbarkeit im Domänen-Baum.
 */
export const MAX_UNTER_UNTER_DOMAENEN = 3;

/**
 * Ebene einer Domäne im Baum (0 = Haupt-, 1 = Unter-, 2 = Unter-Unterdomäne),
 * berechnet aus der flachen Liste. Bricht bei fehlendem Elternteil sicher ab.
 */
export function domaeneEbene(
  id: string,
  elternVon: (id: string) => string | null | undefined,
): number {
  let ebene = 0;
  let eltern = elternVon(id);
  const gesehen = new Set<string>([id]);
  while (eltern && !gesehen.has(eltern)) {
    ebene += 1;
    gesehen.add(eltern);
    eltern = elternVon(eltern);
  }
  return ebene;
}

/** Eine Domäne als Knoten der Domänen-Karte (inkl. Aktivitätszählungen). */
export interface DomaeneKnotenDTO {
  id: string;
  name: string;
  ziel: string;
  /** Kernaufgaben der Domäne. */
  tasks: string[];
  typ: DomaeneTyp;
  elternDomaeneId: string | null;
  aktiv: boolean;
  /** Ist die Domäne archiviert (reversibel deaktiviert)? */
  archiviert: boolean;
  /** Anzahl Vorschläge mit Beschluss. */
  anzahlBeschluesse: number;
  /** Summe Bedenken + Einwände auf noch offenen Vorschlägen. */
  anzahlOffeneEinwaende: number;
}

/** Eine Domäne im Detail (Domänen-Log-Kopf), plus Name der Eltern-Domäne. */
export interface DomaeneDetailDTO extends DomaeneKnotenDTO {
  elternDomaeneName: string | null;
}

/** Ein aktives Domänen-Mitglied, nur Name (für die Teilhabenden-Anzeige im Domänen-Log). */
export interface DomaeneMitgliedNameDTO {
  id: string;
  name: string;
  /** Personenspezifische Avatarfarben (aus Seed/Profil) oder null. */
  avatarColor: string | null;
  avatarTextColor: string | null;
}
