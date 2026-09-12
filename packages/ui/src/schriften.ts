/**
 * Schriften des Design-Systems als Seiteneffekt-Import.
 *
 * Reihenfolge und Auswahl entsprechen exakt dem bisherigen Stand in
 * `apps/web/src/main.tsx`. Der Import muss VOR dem CSS-Import der App stehen,
 * damit die Reihenfolge im gebauten Bundle unverändert bleibt.
 *
 * Sans = Hanken Grotesk (UI), Serif = Source Serif 4 (Überschriften, Fließtext).
 * Beide sind in `tokens.css` als `--font-sans` bzw. `--font-serif` hinterlegt.
 */
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/source-serif-4';
