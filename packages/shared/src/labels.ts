/**
 * Zentrale deutsche Anzeigetexte für die Backend-Enum-Werte (korrekte
 * Großschreibung). In shared, damit Web-Frontend UND API (z. B. PDF-Export)
 * dieselben Bezeichnungen nutzen und nicht auseinanderlaufen.
 */
import type {
  GovernanceTyp,
  GueltigkeitStatus,
  Befristung,
  EinwandSchweregrad,
  VorschlagStatus,
} from './vorgang';
import type { DomaeneTyp } from './domaene';

export const GOVERNANCE_LABEL: Record<GovernanceTyp, string> = {
  governance: 'Governance',
  operativ: 'Operativ',
};

export const VORSCHLAG_STATUS_LABEL: Record<VorschlagStatus, string> = {
  offen: 'Offen',
  entschieden: 'Entschieden',
  zurueckgezogen: 'Zurückgezogen',
};

export const GUELTIGKEIT_STATUS_LABEL: Record<GueltigkeitStatus, string> = {
  gueltig: 'Gültig',
  in_ueberpruefung: 'In Überprüfung',
  ersetzt: 'Ersetzt',
  beendet: 'Beendet',
};

export const BEFRISTUNG_LABEL: Record<Befristung, string> = {
  befristet: 'Befristet',
  unbefristet: 'Unbefristet',
};

export const SCHWEREGRAD_LABEL: Record<EinwandSchweregrad, string> = {
  leicht: 'Leicht',
  schwerwiegend: 'Schwerwiegend',
};

export const DOMAENE_TYP_LABEL: Record<DomaeneTyp, string> = {
  dauerdomaene: 'Dauerdomäne',
  arbeitsdomaene: 'Arbeitsdomäne',
};
