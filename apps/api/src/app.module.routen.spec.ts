import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ===========================================================================
 * KEIN NACKTES `*` MEHR IN EINER ROUTENANGABE
 * ===========================================================================
 *
 * Express 5 bringt `path-to-regexp` 8 mit, und das kennt das nackte `*` nicht
 * mehr. Nest 11 schreibt es beim Start still um und warnt dabei:
 *
 *   Unsupported route path: "/api/*" … Attempting to auto-convert to
 *   "/api/{*path}"
 *
 * DIE WARNUNG IST DER GUTMÜTIGE FALL. Die Umschreibung ist eine
 * Übergangshilfe; fällt sie in einer künftigen Fassung weg, wird daraus ein
 * „Missing parameter name" beim Start — und dann protokolliert die Anwendung
 * entweder nichts mehr oder startet gar nicht. Ein Fehler, der heute nur eine
 * Zeile im Log ist und morgen der Start.
 *
 * DIE QUELLE WAR NICHT UNSER CODE: `nestjs-pino` registriert seine Middleware
 * ab Werk auf `[{ path: '*', method: ALL }]`, und `setGlobalPrefix('api')`
 * macht daraus `/api/*`. Deshalb steht `forRoutes` jetzt ausdrücklich in
 * unserer Konfiguration — eine Vorgabe einer fremden Bibliothek lässt sich
 * nicht anders richtigstellen.
 *
 * WARUM ALS QUELLTEXTPRÜFUNG: Die Angabe verschwindet in einem
 * `DynamicModule` der Bibliothek; aus den Metadaten ist sie nicht mehr
 * herauszulesen. Was sich prüfen lässt, ist das, was wir hinschreiben — und
 * genau dort ist der Fehler auch entstanden.
 */

const QUELLE = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');

/**
 * Der Quelltext OHNE Kommentare.
 *
 * DER ERSTE ENTWURF DIESES TESTS IST GENAU DARÜBER GESTOLPERT: Er schlug an,
 * weil im Kommentar daneben steht, was `nestjs-pino` ab Werk registriert —
 * `[{ path: '*', … }]`. Ein Prüfer, der Prosa für Code hält, meldet einen
 * Fehler, den es nicht gibt, und man gewöhnt sich das Wegklicken an.
 *
 * Die Entfernung ist bewusst einfach gehalten (Block- und Zeilenkommentare).
 * Sie käme bei einer Zeichenkette ins Straucheln, die `//` enthält — in
 * dieser Datei gibt es keine, und der Test prüft ohnehin nur sie.
 */
const OHNE_KOMMENTARE = QUELLE.replace(/\/\*[\s\S]*?\*\//g, '').replace(
  /\/\/.*$/gm,
  '',
);

describe('Routenangaben im AppModule', () => {
  it('findet die Datei überhaupt (sonst prüft der Test nichts)', () => {
    expect(QUELLE).toContain('export class AppModule');
    expect(QUELLE).toContain('forRoutes');
  });

  it('BENUTZT NIRGENDS DAS NACKTE `*`', () => {
    // Trifft `forRoutes('*')` ebenso wie `{ path: '*', … }`.
    const treffer = [
      ...OHNE_KOMMENTARE.matchAll(/forRoutes\(\s*['"]\*['"]/g),
      ...OHNE_KOMMENTARE.matchAll(/path:\s*['"]\*['"]/g),
    ];
    expect(treffer.map((t) => t[0])).toEqual([]);
  });

  it('setzt `forRoutes` am Logger ausdrücklich', () => {
    // Ohne diese Angabe gilt wieder die Vorgabe von `nestjs-pino` — und die
    // ist genau das nackte `*`. Der Test oben würde das NICHT bemerken:
    // Die Vorgabe steht in fremdem Code, nicht in unserem.
    const block = /LoggerModule\.forRoot\(\{[\s\S]*?\n {4}\}\)/.exec(QUELLE);
    expect(block).not.toBeNull();
    expect(block![0]).toContain('forRoutes');
    expect(block![0]).toContain('{*pfad}');
  });
});
