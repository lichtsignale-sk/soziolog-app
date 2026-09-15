/**
 * Lesbare Namen der Seiten, z. B. für das Feedback („auf welcher Seite?").
 *
 * BEWUSST NUR DER SEITENTYP, keine Namen von Domänen oder Vorschlägen: Die
 * gehören der Organisation. Für Rückfragen reicht der Pfad mit der Kennung.
 */
const SEITEN: [RegExp, string][] = [
  [/^\/$/, 'Domänen (Übersicht)'],
  [/^\/domaenen\/[^/]+\/?$/, 'Domänen-Log'],
  [/^\/gesamt-log\/?$/, 'Gesamt-Log'],
  [/^\/korrekturen-log\/?$/, 'Korrekturen-Log'],
  [/^\/statistik\/?$/, 'Statistik'],
  [/^\/konto\/?$/, 'Mein Konto'],
  [/^\/admin(\/.*)?$/, 'Verwaltung'],
];

export function seitenBezeichnung(pfad: string): string {
  return SEITEN.find(([muster]) => muster.test(pfad))?.[1] ?? 'Sonstige Seite';
}

/** Dieselbe Regel wie serverseitig (FeedbackDto): nur ein schlichter Pfad. */
const PFAD_MUSTER = /^\/[A-Za-z0-9\-._~/%]{0,299}$/;

/** Der Pfad, wie ihn der Server annimmt — sonst die Wurzel. */
export function seitenPfad(pfad: string): string {
  return PFAD_MUSTER.test(pfad) ? pfad : '/';
}
