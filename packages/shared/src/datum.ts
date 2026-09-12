/**
 * Gibt das heutige Datum als YYYY-MM-DD zurück (lokale Zeit, kein UTC-Shift).
 * Niemals new Date().toISOString() verwenden – das verursacht Zeitzonen-Bugs.
 */
export function heute(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parst und validiert einen Datums-String im Format YYYY-MM-DD.
 * Wirft einen Fehler bei ungültigem Format oder unmöglichem Datum.
 */
export function datumAusString(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Ungültiges Datumsformat: "${s}". Erwartet: YYYY-MM-DD`);
  }
  const [year, month, day] = s.split('-').map(Number);
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() + 1 !== month ||
    dt.getDate() !== day
  ) {
    throw new Error(`Ungültiges Datum: "${s}"`);
  }
  return s;
}

/**
 * Wandelt einen YYYY-MM-DD-String in ein Date-Objekt (UTC-Mitternacht) um.
 * Für Prisma-Felder mit @db.Date: Prisma speichert und liest DATE-Werte in UTC.
 * Deshalb MUSS hier UTC-Mitternacht erzeugt werden – lokale Mitternacht würde in
 * Zeitzonen mit positivem Offset (z. B. Europe/Berlin) beim Speichern um einen
 * Tag zurückrutschen (Zeitzonen-Falle). Gegenstück: datumStringAusDate().
 */
export function zuDatum(s: string): Date {
  datumAusString(s);
  const [year, month, day] = s.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Wandelt ein aus der DB gelesenes @db.Date (UTC-Mitternacht) zurück in einen
 * YYYY-MM-DD-String. Nutzt UTC-Felder, passend zu zuDatum().
 */
export function datumStringAusDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const t = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${t}`;
}

/**
 * Addiert (oder subtrahiert bei negativem Wert) Kalendertage zu einem
 * YYYY-MM-DD-String und gibt wieder YYYY-MM-DD zurück. Rein datumsbasiert,
 * keine Uhrzeit – z. B. für „gültig bis Folgetag": datumPlusTage(heute(), 1).
 */
export function datumPlusTage(basis: string, tage: number): string {
  datumAusString(basis);
  const [year, month, day] = basis.split('-').map(Number);
  const dt = new Date(year, month - 1, day + tage);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Leitet den Kalendermonat (YYYY-MM) aus einem YYYY-MM-DD-String ab – rein aus
 * dem Kalendertag, ohne Umweg über Date/Zeitzone. So verschiebt sich an
 * Monatsgrenzen nichts (z. B. für „Bedenken je Monat").
 */
export function monatAusDatum(s: string): string {
  datumAusString(s);
  return s.slice(0, 7);
}
