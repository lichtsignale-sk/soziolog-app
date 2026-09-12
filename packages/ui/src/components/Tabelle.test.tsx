import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabelle } from './Tabelle';

/**
 * [K1] Unter `table-layout: auto` bestimmt der längste Inhalt die
 * Spaltenbreite. `truncate` auf einem Element INNERHALB der Zelle bleibt dann
 * wirkungslos, und die Tabelle wächst über ihre Hülle hinaus — gemessen bei
 * 768 px mit einem hundert Zeichen langen Vereinsnamen: 1309 px Inhalt in
 * einer 734 px breiten Hülle.
 *
 * jsdom rechnet kein Layout; geprüft wird deshalb der Mechanismus, der es im
 * Browser verhindert: feste Spaltenbreiten ab `sm` plus `<colgroup>`.
 */
/**
 * Bewusst KEINE echten Tailwind-Klassen: Tailwind durchsucht auch diese Datei
 * und nähme sie als benutzt auf — die Regeln landeten dann im Stylesheet jeder
 * Anwendung, die `@soziolog/ui` einbindet. Geprüft wird ohnehin nur, dass die
 * übergebenen Klassen unverändert am <col> landen.
 */
const BREIT = 'pruef-breit';
const SCHMAL = 'pruef-schmal';

describe('Tabelle', () => {
  it('bleibt ohne Breitenangabe unverändert — bestehende Aufrufer merken nichts', () => {
    render(
      <Tabelle spalten={['A', 'B']} beschriftung="ohne">
        <tr>
          <td>1</td>
          <td>2</td>
        </tr>
      </Tabelle>,
    );
    const tabelle = screen.getByRole('table');
    expect(tabelle.className).toBe('w-full text-left text-sm');
    expect(tabelle.querySelector('colgroup')).toBeNull();
  });

  it('schaltet mit Breitenangabe auf feste Spalten und legt eine colgroup an', () => {
    render(
      <Tabelle
        spalten={['A', 'B']}
        spaltenBreiten={[BREIT, SCHMAL]}
        beschriftung="mit"
      >
        <tr>
          <td>1</td>
          <td>2</td>
        </tr>
      </Tabelle>,
    );
    const tabelle = screen.getByRole('table');
    expect(tabelle.className).toContain('sm:table-fixed');

    const spalten = tabelle.querySelectorAll('colgroup col');
    expect(spalten).toHaveLength(2);
    expect(spalten[0].className).toBe(BREIT);
    expect(spalten[1].className).toBe(SCHMAL);
  });

  it('verträgt eine zu kurze Breitenliste, ohne undefined ins Markup zu schreiben', () => {
    render(
      <Tabelle spalten={['A', 'B']} spaltenBreiten={[BREIT]} beschriftung="kurz">
        <tr>
          <td>1</td>
          <td>2</td>
        </tr>
      </Tabelle>,
    );
    const spalten = screen.getByRole('table').querySelectorAll('colgroup col');
    expect(spalten).toHaveLength(2);
    expect(spalten[1].className).toBe('');
  });
});
