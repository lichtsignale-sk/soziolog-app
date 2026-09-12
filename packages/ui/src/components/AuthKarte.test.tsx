import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthKarte } from './AuthKarte';

/**
 * Die Marke benennt das SYSTEM, nicht das Produkt.
 *
 * Anmeldeseite der Verwaltung und Kundenanwendung trugen beide nur „SozioLog".
 * Wer den Link aus einem Lesezeichen öffnete, sah nicht, wo er gerade ist. In
 * der angemeldeten Ansicht steht die Angabe längst in der Seitenleiste — nur
 * davor fehlte sie, also genau dort, wo die Frage aufkommt.
 */
describe('AuthKarte', () => {
  it('zeigt die Marke unter dem Titel, wenn eine angegeben ist', () => {
    render(
      <AuthKarte titel="SozioLog" marke="Verwaltung" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    expect(screen.getByRole('heading', { name: 'SozioLog' })).toBeInTheDocument();
    expect(screen.getByText('Verwaltung')).toBeInTheDocument();
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
  });

  /** Die Kundenanwendung braucht sie nicht — dort gibt es kein zweites System. */
  it('lässt die Zeile weg, wenn keine Marke angegeben ist', () => {
    render(
      <AuthKarte titel="SozioLog" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    expect(screen.queryByText('Verwaltung')).not.toBeInTheDocument();
    expect(screen.getByText('Anmelden')).toBeInTheDocument();
  });

  it('steht zwischen Titel und Untertitel', () => {
    const { container } = render(
      <AuthKarte titel="SozioLog" marke="Verwaltung" untertitel="Anmelden">
        <p>Inhalt</p>
      </AuthKarte>,
    );

    const texte = Array.from(container.querySelectorAll('h1, p')).map(
      (e) => e.textContent,
    );
    expect(texte.slice(0, 3)).toEqual(['SozioLog', 'Verwaltung', 'Anmelden']);
  });
});
