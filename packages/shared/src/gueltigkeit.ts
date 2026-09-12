/**
 * Verbindliche Grenzlogik der Zeit-/Gültigkeits-Engine – EINE Quelle für
 * Backend (Prisma-Filter/DTOs) und Frontend (Stichtag-Hervorhebung im Gantt).
 * Rein string-basiert auf Kalenderdaten (YYYY-MM-DD), damit keine Uhrzeit oder
 * Zeitzone hineinspielt.
 */

/**
 * Ein Beschluss gilt am Stichtag T, wenn gueltigAb <= T UND
 * (gueltigBis == null ODER gueltigBis > T).
 * gueltigAb ist inklusive (ab dem Tag gültig), gueltigBis exklusiv
 * (gültig bis zum Vortag); null bei gueltigBis = unbegrenzt gültig.
 */
export function giltAmStichtag(
  gueltigAb: string,
  gueltigBis: string | null,
  stichtag: string,
): boolean {
  return gueltigAb <= stichtag && (gueltigBis === null || gueltigBis > stichtag);
}
