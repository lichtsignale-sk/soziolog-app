/**
 * Gemeinsame Initialen-Avatar-Logik (kein/vor Foto-Upload). Farbe wird
 * deterministisch aus dem Namen abgeleitet, damit dieselbe Person immer
 * dieselbe Farbe bekommt. Genutzt von TeilhabendenReihe und Mein Konto.
 */

const PALETTE = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
];

/** Ein- bis zweibuchstabige Initialen aus einem Namen. */
export function initialen(name: string): string {
  const woerter = name.trim().split(/\s+/);
  const erst = woerter[0]?.[0] ?? '';
  const letzt = woerter.length > 1 ? (woerter[woerter.length - 1]?.[0] ?? '') : '';
  return (erst + letzt).toUpperCase();
}

/** Deterministische Avatar-Farbklassen (bg + text) für einen Namen. */
export function farbeFuer(name: string): string {
  let summe = 0;
  for (let i = 0; i < name.length; i++) summe += name.charCodeAt(i);
  return PALETTE[summe % PALETTE.length];
}

/**
 * Ergebnis für die Avatar-Darstellung. Liegen personenspezifische Farben (aus
 * Seed/Profil) vor, werden sie als Inline-Style geliefert; sonst fällt es auf
 * die deterministischen Tailwind-Klassen aus {@link farbeFuer} zurück.
 */
export function avatarStil(
  name: string,
  bg?: string | null,
  text?: string | null,
): { className: string; style?: { backgroundColor: string; color: string } } {
  if (bg) {
    return {
      className: '',
      style: { backgroundColor: bg, color: text ?? '#1f2937' },
    };
  }
  return { className: farbeFuer(name) };
}
