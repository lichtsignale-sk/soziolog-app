/**
 * Typen rund um den PDF-Export. Einzel-Beschluss- und Domänen-Export liefern
 * direkt eine PDF-Datei (kein DTO nötig); der Organisations-Gesamt-Export läuft
 * asynchron und wird per Mail zugestellt – dafür diese Start-Antwort.
 */
import type { DomaeneDetailDTO } from './domaene';
import type { VorschlagDTO } from './vorgang';

/** Antwort auf das Anfragen des Org-Gesamt-Exports (202, Zustellung per Mail). */
export interface ExportStartAntwort {
  status: 'wird_erstellt';
  /** Adresse, an die das fertige PDF geschickt wird. */
  email: string;
}

/** Eine Domäne samt aller ihrer Vorgänge – Baustein des Gesamt-Exports. */
export interface OrganisationExportGruppe {
  domaene: DomaeneDetailDTO;
  vorschlaege: VorschlagDTO[];
}
