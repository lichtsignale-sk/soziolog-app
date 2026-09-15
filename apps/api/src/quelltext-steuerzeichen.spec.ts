import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * KEIN QUELLTEXT MIT ROHEN STEUERZEICHEN.
 *
 * Ein Regex wie `/[\x00-\x1f]/` darf nicht als echte Bytes 0x00…0x1F in der
 * Datei stehen: Git hält sie dann für binär (keine lesbaren Diffs), und die
 * Leak-Prüfung des öffentlichen Exports (`grep -I`) überspringt sie. Genau so
 * geschehen bei `mail.service.ts`. Erlaubt sind Tab, Zeilenvorschub und
 * Wagenrücklauf.
 */
function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return dateien(pfad);
    return /\.(ts|tsx|js|json|sql)$/.test(e.name) ? [pfad] : [];
  });
}

describe('Quelltext ohne rohe Steuerzeichen', () => {
  it('enthält unter src/ keine Bytes 0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F oder 0x7F', () => {
    const betroffen = dateien(join(__dirname)).filter((pfad) =>
      // eslint-disable-next-line no-control-regex
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(readFileSync(pfad, 'latin1')),
    );
    expect(betroffen).toEqual([]);
  });
});
